/**
 * Правила персонажа: распад настроения, настроение по шкале, серия дней, дедлайн «пора кормить».
 */

import {
  EDGE_ACTION_TAP_TARGET,
  readActionProgress,
  writeActionProgress,
} from "./character-needs.js";
import type { ActionProgress } from "./character-needs.js";

export {
  EDGE_ACTION_TAP_TARGET,
  type ActionProgress,
  type ActiveNeed,
  activeNeedFromNeeds,
  applyNeedBonusByAction,
  happyFromNeeds,
  moodFromHappy,
  readNeeds,
  readActionProgress,
  simulateNeedsToNow,
  type PetNeeds,
  writeNeeds,
} from "./character-needs.js";

export function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysUtc(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** После 2 ч без корма — каждые 2 ч теряем до 4 пункта happy (макс. 48 за длинный перерыв). */
export function decayHappyScore(params: {
  happy: number;
  lastFedAt: Date | null;
  lastInteractionAt: Date | null;
  now: Date;
}): number {
  const ref = params.lastFedAt ?? params.lastInteractionAt;
  let h = params.happy;
  if (!ref) return Math.max(0, h - 2);
  const hours = (params.now.getTime() - ref.getTime()) / 3_600_000;
  if (hours < 2) return h;
  const steps = Math.floor((hours - 2) / 2);
  const loss = Math.min(48, steps * 4);
  return Math.max(0, h - loss);
}

/**
 * ISO момента, к которому желательно покормить (8 ч после последнего корма или первого входа).
 * Если уже в прошлом — null.
 */
export function nextCareDeadlineIso(
  lastFedAt: Date | null,
  joinedAt: Date,
  now: Date,
): string | null {
  const ref = lastFedAt ?? joinedAt;
  const deadline = new Date(ref.getTime() + 8 * 3_600_000);
  if (deadline.getTime() <= now.getTime()) return null;
  return deadline.toISOString();
}

export function computeStreakOnFeed(params: {
  careStreakDays: number;
  lastFedYmd: string;
  now: Date;
}): number {
  const today = ymdUtc(params.now);
  if (!params.lastFedYmd) return Math.max(1, params.careStreakDays);
  if (params.lastFedYmd === today) return Math.max(1, params.careStreakDays);
  const y = ymdUtc(addDaysUtc(params.now, -1));
  if (params.lastFedYmd === y) return params.careStreakDays + 1;
  return 1;
}

/** Короткий антиспам для активных действий (мс), кроме тапа по персонажу — он без кулдауна. */
export const EDGE_INTERACT_COOLDOWN_MS = 450;

export type InteractKind = "play" | "pet" | "toilet" | "calm" | "tap";

export type FeedTapOutcome = {
  extra: Record<string, unknown>;
  progress: ActionProgress;
  completed: boolean;
};

export function applyFeedTapProgress(extra: Record<string, unknown>): FeedTapOutcome {
  const p = readActionProgress(extra);
  const next = { ...p, feed: Math.min(EDGE_ACTION_TAP_TARGET, p.feed + 1) };
  const completed = next.feed >= EDGE_ACTION_TAP_TARGET;
  if (completed) next.feed = 0;
  return {
    extra: writeActionProgress(extra, next),
    progress: next,
    completed,
  };
}

function interactExtraKey(kind: InteractKind): string {
  switch (kind) {
    case "play":
      return "lastPlayAt";
    case "pet":
      return "lastPetAt";
    case "toilet":
      return "lastToiletAt";
    case "calm":
      return "lastCalmAt";
    case "tap":
      return "lastTapAt";
    default:
      return "lastPlayAt";
  }
}

export function withInteractTimestamp(
  extra: Record<string, unknown>,
  kind: InteractKind,
  now: Date,
): Record<string, unknown> {
  return { ...extra, [interactExtraKey(kind)]: now.toISOString() };
}

/** Сколько мс ещё ждать до доступного действия; 0 — можно. */
export function interactCooldownRemainingMs(
  extra: Record<string, unknown>,
  kind: InteractKind,
  now: Date,
): number {
  /** Тап в ленте/companion — без лимитера по времени (остальные действия с антиспамом). */
  if (kind === "tap") return 0;
  const raw = extra[interactExtraKey(kind)];
  if (typeof raw !== "string") return 0;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  const elapsed = now.getTime() - t;
  return Math.max(0, EDGE_INTERACT_COOLDOWN_MS - elapsed);
}

export function interactNextAvailableIso(
  extra: Record<string, unknown>,
  kind: InteractKind,
  now: Date,
): string | null {
  const rem = interactCooldownRemainingMs(extra, kind, now);
  if (rem <= 0) return null;
  return new Date(now.getTime() + rem).toISOString();
}

export function interactBonus(kind: InteractKind): { xp: number; happy: number } {
  switch (kind) {
    case "play":
      return { xp: 6, happy: 9 };
    case "pet":
      return { xp: 5, happy: 11 };
    case "toilet":
      return { xp: 4, happy: 7 };
    case "calm":
      return { xp: 5, happy: 12 };
    case "tap":
      return { xp: 1, happy: 2 };
    default:
      return { xp: 5, happy: 8 };
  }
}

export function applyInteractTapProgress(
  extra: Record<string, unknown>,
  kind: InteractKind,
): { extra: Record<string, unknown>; progress: ActionProgress; completed: boolean } {
  const p = readActionProgress(extra);
  if (kind !== "play" && kind !== "toilet") {
    return { extra, progress: p, completed: true };
  }
  const next = { ...p };
  if (kind === "play") next.play = Math.min(EDGE_ACTION_TAP_TARGET, p.play + 1);
  if (kind === "toilet") next.toilet = Math.min(EDGE_ACTION_TAP_TARGET, p.toilet + 1);
  let completed = false;
  if (kind === "play" && next.play >= EDGE_ACTION_TAP_TARGET) {
    next.play = 0;
    completed = true;
  }
  if (kind === "toilet" && next.toilet >= EDGE_ACTION_TAP_TARGET) {
    next.toilet = 0;
    completed = true;
  }
  return {
    extra: writeActionProgress(extra, next),
    progress: next,
    completed,
  };
}

export function parseInteractKind(raw: unknown): InteractKind | null {
  if (raw === "play" || raw === "pet" || raw === "toilet" || raw === "calm" || raw === "tap") return raw;
  return null;
}
