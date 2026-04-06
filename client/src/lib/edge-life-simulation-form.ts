/**
 * Форма «рейтинг жизни» в конструкторе EDGE (зеркало `companion.lifeSimulation` на сервере).
 */

function asObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export type LifeSimFormState = {
  enabled: boolean;
  lifeMin: number;
  lifeMax: number;
  lifeInitial: number;
  intervalFeed: number;
  intervalToilet: number;
  intervalPlay: number;
  intervalCalm: number;
  responseWindowHours: number;
  onTimeBonus: number;
  missedPenalty: number;
  queueFulfillBonus: number;
  maxMoodBonus: number;
  maxQueuePerKind: number;
};

export const DEFAULT_LIFE_SIM_FORM: LifeSimFormState = {
  enabled: false,
  lifeMin: 0,
  lifeMax: 500,
  lifeInitial: 250,
  intervalFeed: 2,
  intervalToilet: 3,
  intervalPlay: 4,
  intervalCalm: 5,
  responseWindowHours: 3,
  onTimeBonus: 50,
  missedPenalty: 15,
  queueFulfillBonus: 10,
  maxMoodBonus: 10,
  maxQueuePerKind: 8,
};

export function lifeSimFormFromConfigJson(configJson: unknown): LifeSimFormState {
  const root = asObj(configJson);
  const comp = asObj(root.companion);
  const raw = asObj(comp.lifeSimulation);
  if (raw.enabled !== true) {
    return { ...DEFAULT_LIFE_SIM_FORM, enabled: false };
  }
  const lr = asObj(raw.lifeRating);
  const iv = asObj(raw.intervalsHours);
  return {
    enabled: true,
    lifeMin: Math.floor(num(lr.min, DEFAULT_LIFE_SIM_FORM.lifeMin)),
    lifeMax: Math.floor(num(lr.max, DEFAULT_LIFE_SIM_FORM.lifeMax)),
    lifeInitial: Math.floor(num(lr.initial, DEFAULT_LIFE_SIM_FORM.lifeInitial)),
    intervalFeed: num(iv.feed, DEFAULT_LIFE_SIM_FORM.intervalFeed),
    intervalToilet: num(iv.toilet, DEFAULT_LIFE_SIM_FORM.intervalToilet),
    intervalPlay: num(iv.play, DEFAULT_LIFE_SIM_FORM.intervalPlay),
    intervalCalm: num(iv.calm, DEFAULT_LIFE_SIM_FORM.intervalCalm),
    responseWindowHours: num(raw.responseWindowHours, DEFAULT_LIFE_SIM_FORM.responseWindowHours),
    onTimeBonus: Math.floor(num(raw.onTimeBonus, DEFAULT_LIFE_SIM_FORM.onTimeBonus)),
    missedPenalty: Math.floor(num(raw.missedPenalty, DEFAULT_LIFE_SIM_FORM.missedPenalty)),
    queueFulfillBonus: Math.floor(num(raw.queueFulfillBonus, DEFAULT_LIFE_SIM_FORM.queueFulfillBonus)),
    maxMoodBonus: Math.floor(num(raw.maxMoodBonus, DEFAULT_LIFE_SIM_FORM.maxMoodBonus)),
    maxQueuePerKind: Math.floor(num(raw.maxQueuePerKind, DEFAULT_LIFE_SIM_FORM.maxQueuePerKind)),
  };
}

/** Тело для `patchEdgeCampaign({ companionLifeSimulation: … })`. */
export function lifeSimFormToPatchPayload(form: LifeSimFormState) {
  return {
    enabled: form.enabled,
    lifeRating: {
      min: form.lifeMin,
      max: form.lifeMax,
      initial: form.lifeInitial,
    },
    intervalsHours: {
      feed: form.intervalFeed,
      toilet: form.intervalToilet,
      play: form.intervalPlay,
      calm: form.intervalCalm,
    },
    responseWindowHours: form.responseWindowHours,
    onTimeBonus: form.onTimeBonus,
    missedPenalty: form.missedPenalty,
    queueFulfillBonus: form.queueFulfillBonus,
    maxMoodBonus: form.maxMoodBonus,
    maxQueuePerKind: form.maxQueuePerKind,
  };
}
