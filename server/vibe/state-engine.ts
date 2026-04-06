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
/** Порог переключения темы после смягчения rule-analyzer (denom + ничья второго места). */
const MIN_CONFIDENCE_TO_SWITCH = 0.48;
const MIN_GAP_TO_SWITCH = 0.08;
const COOLDOWN_MS = 35_000;
const MIN_CONSECUTIVE_BATCHES = 2;
const EMA_ALPHA = 0.4;
const RECENT_WEIGHT_LAST = 3;
const RECENT_WEIGHT_PREV = 2;
const RECENT_WEIGHT_THIRD = 2;
const IS_DEV = process.env.NODE_ENV === "development";
const THEME_SWITCH_THRESHOLD: Record<VibeThemeCode, number> = {
  casual: 0.48,
  romantic: 0.62,
  business: 0.5,
  conflict: 0.56,
  fun: 0.5,
  relax: 0.48,
  support: 0.5,
  gaming: 0.5,
};

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
  const textEntries = msgs
    .filter((m) => m.type === "text")
    .map((m) => ({
      senderId: String(m.senderId ?? ""),
      content: String(m.content ?? "").trim(),
    }))
    // Шум/служебные короткие реплики не должны дергать атмосферу.
    .filter((m) => isMeaningfulForVibe(m.content));
  const texts = textEntries.map((m) => m.content);

  if (texts.length < 3) {
    logVibeDecision({
      chatId,
      action: "skip",
      reason: "not_enough_meaningful_texts",
      meaningfulTexts: texts.length,
      required: 3,
      shouldDeepAnalyze,
    });
    return;
  }
  const participantCount = new Set(textEntries.map((m) => m.senderId).filter(Boolean)).size;
  // Не переключаем тему на монологе одного участника.
  if (participantCount < 2) {
    logVibeDecision({
      chatId,
      action: "skip",
      reason: "single_participant_context",
      participantCount,
      meaningfulTexts: texts.length,
      shouldDeepAnalyze,
    });
    return;
  }
  const weightedTexts = applyRecencyWeights(texts);

  let batchResult: VibeBatchResult;
  if (shouldDeepAnalyze) {
    batchResult = await classifyWithLLM(weightedTexts, state.theme as VibeThemeCode);
  } else {
    batchResult = analyzeMessageBatch(weightedTexts);
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
  const switchThreshold = THEME_SWITCH_THRESHOLD[newTheme] ?? MIN_CONFIDENCE_TO_SWITCH;
  const passesThreshold = newConfidence >= switchThreshold;
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

  logVibeDecision({
    chatId,
    action: shouldSwitch ? "switch" : "hold",
    trigger: shouldDeepAnalyze ? "deep_recalc" : "fast_batch",
    currentTheme,
    candidateTheme: newTheme,
    finalTheme,
    previousConfidence: Number(state.confidence),
    candidateConfidence: Number(newConfidence.toFixed(2)),
    finalConfidence: Number(finalConfidence.toFixed(2)),
    threshold: switchThreshold,
    passesThreshold,
    passesGap,
    cooldownPassed,
    consecutiveCount,
    participantCount,
    meaningfulTexts: texts.length,
    reasonCodes: smoothedResult.reasonCodes,
    themeVersion: updatedState.themeVersion ?? null,
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

function applyRecencyWeights(texts: string[]): string[] {
  if (texts.length <= 1) return texts;

  const weighted: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const fromEnd = texts.length - 1 - i;
    const weight =
      fromEnd === 0
        ? RECENT_WEIGHT_LAST
        : fromEnd === 1
          ? RECENT_WEIGHT_PREV
          : fromEnd === 2
            ? RECENT_WEIGHT_THIRD
            : 1;
    for (let r = 0; r < weight; r++) weighted.push(texts[i]);
  }
  return weighted;
}

function isMeaningfulForVibe(text: string): boolean {
  if (!text) return false;
  if (text.length < 4) return false;
  return /[A-Za-zА-Яа-я0-9]/.test(text);
}

function logVibeDecision(payload: Record<string, unknown>): void {
  if (!IS_DEV) return;
  console.log("[vibe] decision", payload);
}
