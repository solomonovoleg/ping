/**
 * Vibe State Engine — aggregates batch results, applies smoothing/hysteresis,
 * and decides when to switch the visual theme.
 */
import { storage } from "../storage";
import { analyzeMessageBatch } from "./rule-analyzer";
import { classifyWithLLM } from "./llm-classifier";
import { notifyVibeUpdate } from "../realtime/chat";
import { getVibeThemeTokens } from "./theme-profiles";
import type { VibeThemeCode, VibeAxes, VibeBatchResult, VibeUpdatePayload } from "@shared/chat-vibe-types";

const FAST_BATCH_INTERVAL = 4;
const DEEP_BATCH_INTERVAL = 16;
const FAST_WINDOW = 8;
const DEEP_WINDOW = 20;
/** Ниже 0.7 правила почти никогда не «переключали» тему — вайб оставался casual */
const MIN_CONFIDENCE_TO_SWITCH = 0.52;
const MIN_GAP_TO_SWITCH = 0.08;
const COOLDOWN_MS = 35_000;
const MIN_CONSECUTIVE_BATCHES = 1;
const EMA_ALPHA = 0.4;

/**
 * Called after every new message in a DM chat.
 * Decides whether to run analysis and whether to switch the theme.
 */
export async function processNewMessage(chatId: string): Promise<void> {
  const chat = await storage.getChatById(chatId);
  if (!chat || chat.type !== "dm") return;

  const memberIds = await storage.getChatMemberIds(chatId);
  if (memberIds.length !== 2) return;

  const [userA, userB] = await Promise.all([
    storage.getUser(memberIds[0]),
    storage.getUser(memberIds[1]),
  ]);
  if (!userA || !userB) return;

  const aEnabled = (userA as any).vibeEnabled === true;
  const bEnabled = (userB as any).vibeEnabled === true;
  if (!aEnabled && !bEnabled) return;

  let state = await storage.getVibeState(chatId);
  const counter = (state?.messageCounter ?? 0) + 1;

  if (!state) {
    state = await storage.upsertVibeState(chatId, {
      theme: "casual",
      confidence: 0.3,
      axes: { warmth: 50, tension: 10, playfulness: 30, intimacy: 20, formality: 30, energy: 40 },
      messageCounter: counter,
    });
  } else {
    state = await storage.upsertVibeState(chatId, {
      theme: state.theme as VibeThemeCode,
      confidence: Number(state.confidence),
      axes: {
        warmth: state.warmth,
        tension: state.tension,
        playfulness: state.playfulness,
        intimacy: state.intimacy,
        formality: state.formality,
        energy: state.energy,
      },
      messageCounter: counter,
    });
  }

  const shouldFastAnalyze = counter % FAST_BATCH_INTERVAL === 0;
  const shouldDeepAnalyze = counter % DEEP_BATCH_INTERVAL === 0;

  if (!shouldFastAnalyze && !shouldDeepAnalyze) return;

  const window = shouldDeepAnalyze ? DEEP_WINDOW : FAST_WINDOW;
  const msgs = await storage.getMessagesByChatId(chatId, window);
  const texts = msgs
    .filter((m) => m.type === "text" && m.content?.trim())
    .map((m) => m.content);

  if (texts.length < 3) return;

  let batchResult: VibeBatchResult;
  if (shouldDeepAnalyze) {
    batchResult = await classifyWithLLM(texts, state.theme as VibeThemeCode);
  } else {
    batchResult = analyzeMessageBatch(texts);
  }

  await storage.createVibeBatch({
    chatId,
    windowSize: window,
    dominantPattern: batchResult.dominantPattern,
    secondaryPattern: batchResult.secondaryPattern,
    confidence: batchResult.confidence,
    axes: batchResult.axes,
    toxicityFlag: batchResult.reasonCodes.includes("conflict_markers") && batchResult.axes.tension >= 65,
  });

  const recentBatches = await storage.getRecentVibeBatches(chatId, 4);
  const smoothedResult = smoothBatches(recentBatches, batchResult);

  const currentTheme = state.theme as VibeThemeCode;
  const newTheme = smoothedResult.dominantPattern;
  const newConfidence = smoothedResult.confidence;

  const themeChanged = newTheme !== currentTheme;
  const passesThreshold = newConfidence >= MIN_CONFIDENCE_TO_SWITCH;
  const passesGap = newConfidence - Number(state.confidence) >= MIN_GAP_TO_SWITCH || newTheme !== currentTheme;

  const cooldownPassed = !state.lastBatchAt ||
    Date.now() - new Date(state.lastBatchAt).getTime() >= COOLDOWN_MS;

  const consecutiveCount = countConsecutiveDominant(recentBatches, newTheme);

  const shouldSwitch =
    themeChanged &&
    passesThreshold &&
    cooldownPassed &&
    consecutiveCount >= MIN_CONSECUTIVE_BATCHES;

  const finalTheme = shouldSwitch ? newTheme : currentTheme;
  const finalConfidence = shouldSwitch ? newConfidence : Math.max(Number(state.confidence), newConfidence * 0.6);

  const updatedState = await storage.upsertVibeState(chatId, {
    theme: finalTheme,
    confidence: finalConfidence,
    axes: smoothedResult.axes,
    messageCounter: counter,
    touchLastBatchAt: true,
    ...(shouldSwitch && { themeVersion: (state.themeVersion ?? 1) + 1 }),
  });

  if (shouldSwitch) {
    await storage.createVibeHistoryEntry({
      chatId,
      oldTheme: currentTheme,
      newTheme: finalTheme,
      oldConfidence: Number(state.confidence),
      newConfidence: finalConfidence,
      triggerType: shouldDeepAnalyze ? "deep_recalc" : "fast_batch",
    });
  }

  const tokens = getVibeThemeTokens(finalTheme);
  const payload: VibeUpdatePayload = {
    type: "chat-vibe-update",
    chatId,
    theme: finalTheme,
    confidence: finalConfidence,
    tokens,
    visualIntensity: smoothedResult.visualIntensity,
  };

  const aSharesWith = (userA as any).vibeShareWithPartner === true;
  const bSharesWith = (userB as any).vibeShareWithPartner === true;

  const aSeesVibe = aEnabled || (bEnabled && bSharesWith);
  const bSeesVibe = bEnabled || (aEnabled && aSharesWith);

  if (aSeesVibe || bSeesVibe) {
    notifyVibeUpdate(chatId, payload);
  }
}

// ── Smoothing ────────────────────────────────────────────────

type BatchLike = {
  dominantPattern: string;
  confidence: string;
  warmth: number;
  tension: number;
  playfulness: number;
  intimacy: number;
  formality: number;
  energy: number;
};

function smoothBatches(recentBatches: BatchLike[], latest: VibeBatchResult): VibeBatchResult {
  if (recentBatches.length <= 1) return latest;

  let smoothedAxes: VibeAxes = { ...latest.axes };
  let smoothedConfidence = latest.confidence;

  for (let i = 1; i < recentBatches.length; i++) {
    const older = recentBatches[i];
    const olderAxes: VibeAxes = {
      warmth: older.warmth,
      tension: older.tension,
      playfulness: older.playfulness,
      intimacy: older.intimacy,
      formality: older.formality,
      energy: older.energy,
    };
    smoothedAxes = emaAxes(smoothedAxes, olderAxes, EMA_ALPHA);
    smoothedConfidence = EMA_ALPHA * smoothedConfidence + (1 - EMA_ALPHA) * Number(older.confidence);
  }

  return {
    ...latest,
    axes: roundAxes(smoothedAxes),
    confidence: Math.round(smoothedConfidence * 100) / 100,
  };
}

function emaAxes(current: VibeAxes, older: VibeAxes, alpha: number): VibeAxes {
  return {
    warmth: alpha * current.warmth + (1 - alpha) * older.warmth,
    tension: alpha * current.tension + (1 - alpha) * older.tension,
    playfulness: alpha * current.playfulness + (1 - alpha) * older.playfulness,
    intimacy: alpha * current.intimacy + (1 - alpha) * older.intimacy,
    formality: alpha * current.formality + (1 - alpha) * older.formality,
    energy: alpha * current.energy + (1 - alpha) * older.energy,
  };
}

function roundAxes(axes: VibeAxes): VibeAxes {
  return {
    warmth: Math.round(axes.warmth),
    tension: Math.round(axes.tension),
    playfulness: Math.round(axes.playfulness),
    intimacy: Math.round(axes.intimacy),
    formality: Math.round(axes.formality),
    energy: Math.round(axes.energy),
  };
}

function countConsecutiveDominant(batches: BatchLike[], theme: string): number {
  let count = 0;
  for (const b of batches) {
    if (b.dominantPattern === theme) count++;
    else break;
  }
  return count;
}
