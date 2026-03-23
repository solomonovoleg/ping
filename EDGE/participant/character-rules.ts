/**
 * Правила персонажа: распад настроения, настроение по шкале, серия дней, дедлайн «пора кормить».
 */

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

export function moodFromHappy(h: number): "happy" | "neutral" | "sad" {
  if (h >= 65) return "happy";
  if (h >= 35) return "neutral";
  return "sad";
}

export type PetNeeds = {
  hunger: number;
  hygiene: number;
  energy: number;
  comfort: number;
};

export type ActiveNeed = "hungry" | "dirty" | "bored" | "anxious" | null;

export type ActionProgress = {
  feed: number;
  toilet: number;
  play: number;
};

export const EDGE_ACTION_TAP_TARGET = 15;

const NEED_MIN = 0;
const NEED_MAX = 100;
const NEED_ALERT_THRESHOLD = 35;
const MAX_DECAY_HOURS_PER_TICK = 72;

const DECAY_PER_HOUR: PetNeeds = {
  hunger: 1.6,
  hygiene: 1.2,
  energy: 0.9,
  comfort: 0.8,
};

function clampNeed(v: number): number {
  return Math.max(NEED_MIN, Math.min(NEED_MAX, Math.round(v)));
}

export function readNeeds(extra: Record<string, unknown>): PetNeeds {
  const raw = extra.needs;
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (k: keyof PetNeeds, fallback: number): number => {
    const v = obj[k];
    return typeof v === "number" && Number.isFinite(v) ? clampNeed(v) : fallback;
  };
  return {
    hunger: num("hunger", 72),
    hygiene: num("hygiene", 72),
    energy: num("energy", 72),
    comfort: num("comfort", 72),
  };
}

export function writeNeeds(extra: Record<string, unknown>, needs: PetNeeds): Record<string, unknown> {
  return {
    ...extra,
    needs: {
      hunger: clampNeed(needs.hunger),
      hygiene: clampNeed(needs.hygiene),
      energy: clampNeed(needs.energy),
      comfort: clampNeed(needs.comfort),
    },
  };
}

export function readActionProgress(extra: Record<string, unknown>): ActionProgress {
  const raw = extra.actionProgress;
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (k: keyof ActionProgress): number => {
    const v = obj[k];
    if (typeof v !== "number" || !Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(EDGE_ACTION_TAP_TARGET, Math.floor(v)));
  };
  return {
    feed: num("feed"),
    toilet: num("toilet"),
    play: num("play"),
  };
}

export function writeActionProgress(
  extra: Record<string, unknown>,
  progress: ActionProgress,
): Record<string, unknown> {
  return {
    ...extra,
    actionProgress: {
      feed: Math.max(0, Math.min(EDGE_ACTION_TAP_TARGET, Math.floor(progress.feed))),
      toilet: Math.max(0, Math.min(EDGE_ACTION_TAP_TARGET, Math.floor(progress.toilet))),
      play: Math.max(0, Math.min(EDGE_ACTION_TAP_TARGET, Math.floor(progress.play))),
    },
  };
}

export function happyFromNeeds(needs: PetNeeds): number {
  const h = clampNeed(needs.hunger);
  const hy = clampNeed(needs.hygiene);
  const e = clampNeed(needs.energy);
  const c = clampNeed(needs.comfort);
  return clampNeed(h * 0.34 + hy * 0.28 + e * 0.2 + c * 0.18);
}

export function activeNeedFromNeeds(needs: PetNeeds): ActiveNeed {
  if (needs.hunger < NEED_ALERT_THRESHOLD) return "hungry";
  if (needs.hygiene < NEED_ALERT_THRESHOLD) return "dirty";
  if (needs.energy < NEED_ALERT_THRESHOLD) return "bored";
  if (needs.comfort < NEED_ALERT_THRESHOLD) return "anxious";
  return null;
}

export function simulateNeedsToNow(
  extra: Record<string, unknown>,
  now: Date,
): { extra: Record<string, unknown>; needs: PetNeeds; happy: number; mood: "happy" | "neutral" | "sad"; activeNeed: ActiveNeed } {
  const prev = typeof extra.lastSimulatedAt === "string" ? new Date(extra.lastSimulatedAt) : null;
  const nowMs = now.getTime();
  const prevMs = prev && !Number.isNaN(prev.getTime()) ? prev.getTime() : nowMs;
  const elapsedHoursRaw = Math.max(0, (nowMs - prevMs) / 3_600_000);
  const elapsedHours = Math.min(MAX_DECAY_HOURS_PER_TICK, elapsedHoursRaw);
  const base = readNeeds(extra);
  const next: PetNeeds = {
    hunger: clampNeed(base.hunger - elapsedHours * DECAY_PER_HOUR.hunger),
    hygiene: clampNeed(base.hygiene - elapsedHours * DECAY_PER_HOUR.hygiene),
    energy: clampNeed(base.energy - elapsedHours * DECAY_PER_HOUR.energy),
    comfort: clampNeed(base.comfort - elapsedHours * DECAY_PER_HOUR.comfort),
  };
  const happy = happyFromNeeds(next);
  const mood = moodFromHappy(happy);
  const activeNeed = activeNeedFromNeeds(next);
  return {
    extra: { ...writeNeeds(extra, next), activeNeed, lastSimulatedAt: now.toISOString() },
    needs: next,
    happy,
    mood,
    activeNeed,
  };
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

/** Короткий антиспам для активных действий (мс). */
export const EDGE_INTERACT_COOLDOWN_MS = 450;

/** Тап по персонажу — короткий антиспам. */
export const EDGE_TAP_COOLDOWN_MS = 600;

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
  const raw = extra[interactExtraKey(kind)];
  if (typeof raw !== "string") return 0;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  const elapsed = now.getTime() - t;
  const windowMs = kind === "tap" ? EDGE_TAP_COOLDOWN_MS : EDGE_INTERACT_COOLDOWN_MS;
  return Math.max(0, windowMs - elapsed);
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

export function applyNeedBonusByAction(needs: PetNeeds, kind: InteractKind | "feed"): PetNeeds {
  const next = { ...needs };
  if (kind === "feed") {
    next.hunger = clampNeed(next.hunger + 36);
    next.comfort = clampNeed(next.comfort + 8);
    return next;
  }
  if (kind === "toilet") {
    next.hygiene = clampNeed(next.hygiene + 40);
    next.comfort = clampNeed(next.comfort + 5);
    return next;
  }
  if (kind === "play") {
    next.energy = clampNeed(next.energy + 34);
    next.comfort = clampNeed(next.comfort + 7);
    return next;
  }
  if (kind === "calm") {
    next.comfort = clampNeed(next.comfort + 26);
    next.energy = clampNeed(next.energy + 6);
    return next;
  }
  if (kind === "pet") {
    next.comfort = clampNeed(next.comfort + 18);
    next.energy = clampNeed(next.energy + 4);
    return next;
  }
  if (kind === "tap") {
    next.comfort = clampNeed(next.comfort + 2);
    return next;
  }
  return next;
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
