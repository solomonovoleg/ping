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

export function moodFromHappy(h: number): "happy" | "neutral" | "sad" {
  if (h >= 65) return "happy";
  if (h >= 35) return "neutral";
  return "sad";
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

export function applyNeedBonusByAction(needs: PetNeeds, kind: "play" | "pet" | "toilet" | "calm" | "tap" | "feed"): PetNeeds {
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
