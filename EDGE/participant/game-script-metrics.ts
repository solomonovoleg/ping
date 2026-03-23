/**
 * Метрики «скриптов» кампании: серия заходов, счётчики действий за календарный день (UTC).
 * Хранятся в `edge_character_states.extra` (jsonb).
 */

import { addDaysUtc, ymdUtc } from "./character-rules.js";

const KEYS = {
  gameDailyYmd: "gameDailyYmd",
  lastGameVisitYmd: "lastGameVisitYmd",
  gameLoginStreakDays: "gameLoginStreakDays",
  dailyTapCount: "dailyTapCount",
  dailyFeedCount: "dailyFeedCount",
  dailyPlayCount: "dailyPlayCount",
  dailyToiletCount: "dailyToiletCount",
  dailyCalmCount: "dailyCalmCount",
  dailyPetCount: "dailyPetCount",
} as const;

export type GameScriptMetricsPublic = {
  gameDailyYmd: string;
  gameLoginStreakDays: number;
  dailyTapCount: number;
  dailyFeedCount: number;
  dailyPlayCount: number;
  dailyToiletCount: number;
  dailyCalmCount: number;
  dailyPetCount: number;
};

function num(extra: Record<string, unknown>, k: string): number {
  const v = extra[k];
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/** Сброс дневных счётчиков при смене календарного дня (UTC). */
export function rolloverGameDayIfNeeded(extra: Record<string, unknown>, now: Date): Record<string, unknown> {
  const today = ymdUtc(now);
  const bucket = typeof extra[KEYS.gameDailyYmd] === "string" ? (extra[KEYS.gameDailyYmd] as string) : "";
  if (bucket === today) return extra;
  return {
    ...extra,
    [KEYS.gameDailyYmd]: today,
    [KEYS.dailyTapCount]: 0,
    [KEYS.dailyFeedCount]: 0,
    [KEYS.dailyPlayCount]: 0,
    [KEYS.dailyToiletCount]: 0,
    [KEYS.dailyCalmCount]: 0,
    [KEYS.dailyPetCount]: 0,
  };
}

/** Первый заход за день в компаньон — увеличивает серию дней подряд. */
export function stampGameVisit(extra: Record<string, unknown>, now: Date): Record<string, unknown> {
  const e = rolloverGameDayIfNeeded(extra, now);
  const today = ymdUtc(now);
  const last = typeof e[KEYS.lastGameVisitYmd] === "string" ? (e[KEYS.lastGameVisitYmd] as string) : "";
  if (last === today) return e;

  let streak = num(e, KEYS.gameLoginStreakDays);
  const yest = ymdUtc(addDaysUtc(now, -1));
  if (last === yest) streak = streak + 1;
  else streak = 1;

  return {
    ...e,
    [KEYS.lastGameVisitYmd]: today,
    [KEYS.gameLoginStreakDays]: streak,
  };
}

function inc(extra: Record<string, unknown>, key: string): Record<string, unknown> {
  const n = num(extra, key);
  return { ...extra, [key]: n + 1 };
}

export function bumpDailyAfterFeed(extra: Record<string, unknown>, now: Date): Record<string, unknown> {
  const e = stampGameVisit(extra, now);
  return inc(e, KEYS.dailyFeedCount);
}

export type InteractKindForMetrics = "play" | "pet" | "toilet" | "calm" | "tap";

export function bumpDailyAfterInteract(
  extra: Record<string, unknown>,
  now: Date,
  kind: InteractKindForMetrics,
): Record<string, unknown> {
  const e = stampGameVisit(extra, now);
  switch (kind) {
    case "play":
      return inc(e, KEYS.dailyPlayCount);
    case "pet":
      return inc(e, KEYS.dailyPetCount);
    case "toilet":
      return inc(e, KEYS.dailyToiletCount);
    case "calm":
      return inc(e, KEYS.dailyCalmCount);
    case "tap":
      return inc(e, KEYS.dailyTapCount);
    default:
      return e;
  }
}

/** Только открытие состояния (без действий) — rollover + серия заходов. */
export function touchCompanionOpen(extra: Record<string, unknown>, now: Date): Record<string, unknown> {
  return stampGameVisit(extra, now);
}

export function readGameScriptMetrics(extra: Record<string, unknown>, now: Date): GameScriptMetricsPublic {
  const e = rolloverGameDayIfNeeded(extra, now);
  const today = ymdUtc(now);
  return {
    gameDailyYmd: typeof e[KEYS.gameDailyYmd] === "string" ? (e[KEYS.gameDailyYmd] as string) : today,
    gameLoginStreakDays: num(e, KEYS.gameLoginStreakDays),
    dailyTapCount: num(e, KEYS.dailyTapCount),
    dailyFeedCount: num(e, KEYS.dailyFeedCount),
    dailyPlayCount: num(e, KEYS.dailyPlayCount),
    dailyToiletCount: num(e, KEYS.dailyToiletCount),
    dailyCalmCount: num(e, KEYS.dailyCalmCount),
    dailyPetCount: num(e, KEYS.dailyPetCount),
  };
}
