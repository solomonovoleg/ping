/**
 * Rule-based vibe analyzer for chat messages.
 * Pure function, zero dependencies — fast, deterministic, testable.
 */
import type { VibeBatchResult, VibeThemeCode, VibeAxes } from "@shared/chat-vibe-types";

// ── Lexical dictionaries ─────────────────────────────────────

const ROMANTIC_MARKERS = [
  "люблю", "скучаю", "малыш", "малышка", "солнышко", "зайка", "зай",
  "котик", "котенок", "милый", "милая", "нежн", "целую", "обнимаю",
  "сердц", "love", "miss you", "babe", "darling", "honey", "sweet",
  "❤️", "💕", "💗", "💖", "💘", "😘", "😍", "🥰", "💋", "❤",
];

const CONFLICT_MARKERS = [
  "бесишь", "достал", "достала", "хватит", "заткнись", "отвали",
  "ненавижу", "идиот", "дура", "дурак", "тупой", "тупая",
  "злишь", "бесит", "пошел", "пошла", "отстань",
  "fuck", "hate", "shut up", "idiot", "stupid",
  "😡", "🤬", "😤",
];

const MAT_RE = /\b(?:бля|хуй|хуе|пизд|ебл|ебан|сук[аи]|нахуй|пиздец|ёб|еб[аеёо]н|хер(?:ов|н[яю]))\w*/i;

const FUN_MARKERS = [
  "ахах", "хаха", "хехе", "лол", "ржу", "кек", "рофл",
  "lol", "lmao", "rofl", "haha", "hehe",
  "😂", "🤣", "😆", "😹", "💀",
];

const BUSINESS_MARKERS = [
  "задача", "проект", "дедлайн", "бюджет", "встреча", "клиент",
  "оплата", "договор", "отчет", "отчёт", "работа", "совещани",
  "презентац", "коллег", "KPI", "менеджер", "тикет",
  "deadline", "budget", "meeting", "project", "client", "invoice",
  "task", "sprint", "deploy", "release",
];

const GAMING_MARKERS = [
  "катка", "каткой", "каток", "раунд", "стрим", "лут",
  "мобы", "респ", "камп", "фарм", "гг", "gg", "wp",
  "ранк", "рейд", "данж", "скилл", "абилк", "нерф", "бафф",
  "game", "stream", "rank", "noob", "pro",
  "🎮", "🕹️",
];

const SUPPORT_MARKERS = [
  "держись", "всё будет", "всё наладится", "я рядом", "обними",
  "сочувств", "поддержк", "помощь", "помогу", "выслушай",
  "жаль", "сожалею", "переживаю", "не грусти",
  "sorry", "support", "feel better", "hang in there",
  "🫂", "🤗", "💙",
];

const PLANNING_MARKERS = [
  "когда", "куда", "где встре", "давай в", "во сколько",
  "забронир", "заказ", "такси", "билет", "маршрут",
  "план", "запланир",
  "when", "where", "book", "schedule",
];

// ── Scoring helpers ──────────────────────────────────────────

function countMarkers(text: string, markers: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const m of markers) {
    let idx = 0;
    while ((idx = lower.indexOf(m.toLowerCase(), idx)) !== -1) {
      count++;
      idx += m.length;
    }
  }
  return count;
}

function emojiDensity(texts: string[]): number {
  const joined = texts.join(" ");
  const emojiRe = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}❤️💕💗💖💘💋💙💚💛🖤🤍]/gu;
  const emojis = joined.match(emojiRe) ?? [];
  const words = joined.split(/\s+/).filter(Boolean);
  return words.length > 0 ? emojis.length / words.length : 0;
}

function averageLength(texts: string[]): number {
  if (texts.length === 0) return 0;
  return texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
}

function exclamationRate(texts: string[]): number {
  const total = texts.length;
  if (total === 0) return 0;
  return texts.filter((t) => t.includes("!")).length / total;
}

function matCount(texts: string[]): number {
  return texts.reduce((sum, t) => sum + (MAT_RE.test(t) ? 1 : 0), 0);
}

function youWeRatio(texts: string[]): number {
  const joined = texts.join(" ").toLowerCase();
  const youRe = /\bты\b|\bтебе\b|\bтебя\b|\bтвой\b|\bтвоей\b|\byou\b|\byour\b/gi;
  const weRe = /\bмы\b|\bнас\b|\bнам\b|\bнаш\b|\bwe\b|\bour\b|\bus\b/gi;
  const youCount = (joined.match(youRe) ?? []).length;
  const weCount = (joined.match(weRe) ?? []).length;
  return youCount + weCount;
}

// ── Main analyzer ────────────────────────────────────────────

type ThemeScore = { theme: VibeThemeCode; score: number };

export function analyzeMessageBatch(texts: string[]): VibeBatchResult {
  if (texts.length === 0) {
    return defaultResult();
  }

  const joined = texts.join(" ");
  const msgCount = texts.length;

  const romanticHits = countMarkers(joined, ROMANTIC_MARKERS);
  const conflictHits = countMarkers(joined, CONFLICT_MARKERS) + matCount(texts) * 2;
  const funHits = countMarkers(joined, FUN_MARKERS);
  const businessHits = countMarkers(joined, BUSINESS_MARKERS);
  const gamingHits = countMarkers(joined, GAMING_MARKERS);
  const supportHits = countMarkers(joined, SUPPORT_MARKERS);
  const planningHits = countMarkers(joined, PLANNING_MARKERS);

  const avgLen = averageLength(texts);
  const emDens = emojiDensity(texts);
  const exclRate = exclamationRate(texts);
  const ywRatio = youWeRatio(texts);

  const scores: ThemeScore[] = [
    { theme: "romantic", score: romanticHits * 3 + (emDens > 0.15 ? 2 : 0) },
    { theme: "conflict", score: conflictHits * 4 + (exclRate > 0.5 ? 3 : 0) },
    { theme: "fun", score: funHits * 3 + (emDens > 0.1 ? 1 : 0) },
    { theme: "business", score: businessHits * 3 + (avgLen > 80 ? 2 : 0) },
    { theme: "gaming", score: gamingHits * 3 },
    { theme: "support", score: supportHits * 3 },
    { theme: "relax", score: (avgLen < 30 && emDens < 0.05 && conflictHits === 0 ? 3 : 0) },
  ];

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1];

  const maxPossible = Math.max(msgCount * 4, 1);
  const rawConfidence = Math.min(top.score / maxPossible, 1);

  let dominant: VibeThemeCode = top.score >= 3 ? top.theme : "casual";
  let confidence = top.score >= 3 ? 0.4 + rawConfidence * 0.5 : 0.3;

  if (top.score > 0 && second.score > 0 && top.score - second.score <= 2) {
    confidence *= 0.8;
  }

  confidence = Math.round(confidence * 100) / 100;

  const secondaryPattern: VibeThemeCode | undefined =
    second.score >= 2 && second.theme !== dominant ? second.theme : undefined;

  const axes = computeAxes(texts, dominant, {
    romanticHits, conflictHits, funHits, businessHits, supportHits,
    avgLen, emDens, exclRate, ywRatio,
  });

  const reasonCodes = buildReasonCodes({
    romanticHits, conflictHits, funHits, businessHits, gamingHits,
    supportHits, planningHits, emDens, exclRate, avgLen,
  });

  const toxicityFlag = conflictHits >= 4 || matCount(texts) >= 3;
  const visualIntensity: 0 | 1 | 2 = confidence >= 0.7 ? 2 : confidence >= 0.5 ? 1 : 0;

  return {
    dominantPattern: dominant,
    secondaryPattern,
    confidence,
    axes,
    reasonCodes,
    visualIntensity,
  };
}

// ── Axes computation ─────────────────────────────────────────

type HitStats = {
  romanticHits: number;
  conflictHits: number;
  funHits: number;
  businessHits: number;
  supportHits: number;
  avgLen: number;
  emDens: number;
  exclRate: number;
  ywRatio: number;
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function computeAxes(texts: string[], dominant: VibeThemeCode, stats: HitStats): VibeAxes {
  const { romanticHits, conflictHits, funHits, businessHits, supportHits, avgLen, emDens, exclRate, ywRatio } = stats;
  const n = texts.length || 1;

  let warmth = 50 + (romanticHits * 6) + (supportHits * 5) + (funHits * 3) - (conflictHits * 8);
  let tension = 10 + (conflictHits * 12) + (exclRate * 20) - (funHits * 3);
  let playfulness = 20 + (funHits * 8) + (emDens * 60) - (businessHits * 4) - (conflictHits * 5);
  let intimacy = 20 + (romanticHits * 7) + (ywRatio / n * 10) + (supportHits * 4);
  let formality = 30 + (businessHits * 8) + (avgLen > 100 ? 15 : 0) - (funHits * 5) - (emDens * 40);
  let energy = 40 + (funHits * 5) + (exclRate * 25) + (emDens * 30) - (avgLen > 120 ? 10 : 0);

  return {
    warmth: clamp(warmth),
    tension: clamp(tension),
    playfulness: clamp(playfulness),
    intimacy: clamp(intimacy),
    formality: clamp(formality),
    energy: clamp(energy),
  };
}

// ── Reason codes ─────────────────────────────────────────────

function buildReasonCodes(stats: {
  romanticHits: number; conflictHits: number; funHits: number;
  businessHits: number; gamingHits: number; supportHits: number;
  planningHits: number; emDens: number; exclRate: number; avgLen: number;
}): string[] {
  const codes: string[] = [];
  if (stats.romanticHits >= 2) codes.push("romantic_markers");
  if (stats.conflictHits >= 2) codes.push("conflict_markers");
  if (stats.funHits >= 2) codes.push("laughter_markers");
  if (stats.businessHits >= 2) codes.push("business_markers");
  if (stats.gamingHits >= 2) codes.push("gaming_markers");
  if (stats.supportHits >= 2) codes.push("support_markers");
  if (stats.planningHits >= 2) codes.push("planning_markers");
  if (stats.emDens > 0.15) codes.push("high_emoji_density");
  if (stats.exclRate > 0.5) codes.push("high_exclamation_rate");
  if (stats.avgLen < 20) codes.push("short_messages");
  if (stats.avgLen > 100) codes.push("long_messages");
  if (codes.length === 0) codes.push("no_strong_signals");
  return codes;
}

function defaultResult(): VibeBatchResult {
  return {
    dominantPattern: "casual",
    confidence: 0.3,
    axes: { warmth: 50, tension: 10, playfulness: 30, intimacy: 20, formality: 30, energy: 40 },
    reasonCodes: ["no_messages"],
    visualIntensity: 0,
  };
}
