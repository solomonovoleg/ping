/**
 * Рейтинг жизни персонажа + очередь запросов (голод, туалет, игра, спокойствие).
 * Конфиг: `config_json.companion.lifeSimulation` (включается создателем).
 */

export type LifeSimKind = "feed" | "toilet" | "play" | "calm";

export type LifeSimulationResolvedConfig = {
  enabled: boolean;
  lifeMin: number;
  lifeMax: number;
  lifeInitial: number;
  intervalHours: Record<LifeSimKind, number>;
  responseWindowHours: number;
  onTimeBonus: number;
  missedPenalty: number;
  queueFulfillBonus: number;
  maxMoodBonus: number;
  maxQueuePerKind: number;
};

export type LifeQueueItem = {
  id: string;
  kind: LifeSimKind;
  spawnedAt: string;
  penalized: boolean;
};

const KINDS: LifeSimKind[] = ["feed", "toilet", "play", "calm"];

function asObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function makeId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* ignore */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

/** Читает `config_json` кампании. По умолчанию выключено (обратная совместимость). */
export function parseLifeSimulationConfig(configJson: unknown): LifeSimulationResolvedConfig {
  const root = asObj(configJson);
  const comp = asObj(root.companion);
  const raw = asObj(comp.lifeSimulation);
  const enabled = raw.enabled === true;
  const lr = asObj(raw.lifeRating);
  const lifeMin = clamp(Math.floor(num(lr.min, 0)), 0, 1_000_000);
  const lifeMax = clamp(Math.floor(num(lr.max, 500)), lifeMin + 1, 1_000_000);
  const lifeInitial = clamp(Math.floor(num(lr.initial, 250)), lifeMin, lifeMax);
  const iv = asObj(raw.intervalsHours);
  const intervalHours: Record<LifeSimKind, number> = {
    feed: clamp(num(iv.feed, 2), 0.25, 168),
    toilet: clamp(num(iv.toilet, 3), 0.25, 168),
    play: clamp(num(iv.play, 4), 0.25, 168),
    calm: clamp(num(iv.calm, 5), 0.25, 168),
  };
  const responseWindowHours = clamp(num(raw.responseWindowHours, 3), 0.25, 168);
  const onTimeBonus = clamp(Math.floor(num(raw.onTimeBonus, 50)), 0, 10_000);
  const missedPenalty = clamp(Math.floor(num(raw.missedPenalty, 15)), 0, 10_000);
  const queueFulfillBonus = clamp(Math.floor(num(raw.queueFulfillBonus, 10)), 0, 10_000);
  const maxMoodBonus = clamp(Math.floor(num(raw.maxMoodBonus, 10)), 0, 10_000);
  const maxQueuePerKind = clamp(Math.floor(num(raw.maxQueuePerKind, 8)), 1, 50);
  return {
    enabled,
    lifeMin,
    lifeMax,
    lifeInitial,
    intervalHours,
    responseWindowHours,
    onTimeBonus,
    missedPenalty,
    queueFulfillBonus,
    maxMoodBonus,
    maxQueuePerKind,
  };
}

export function readLifeRating(extra: Record<string, unknown>, cfg: LifeSimulationResolvedConfig): number {
  const v = extra.lifeRating;
  if (typeof v === "number" && Number.isFinite(v)) return clamp(Math.round(v), cfg.lifeMin, cfg.lifeMax);
  return cfg.lifeInitial;
}

function writeLifeRating(extra: Record<string, unknown>, rating: number, cfg: LifeSimulationResolvedConfig): Record<string, unknown> {
  return { ...extra, lifeRating: clamp(Math.round(rating), cfg.lifeMin, cfg.lifeMax) };
}

export function readLifeQueue(extra: Record<string, unknown>): LifeQueueItem[] {
  const raw = extra.lifeNeedQueue;
  if (!Array.isArray(raw)) return [];
  const out: LifeQueueItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const kind = o.kind;
    if (kind !== "feed" && kind !== "toilet" && kind !== "play" && kind !== "calm") continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : makeId();
    const spawnedAt = typeof o.spawnedAt === "string" ? o.spawnedAt : new Date().toISOString();
    const penalized = o.penalized === true;
    out.push({ id, kind, spawnedAt, penalized });
  }
  return out;
}

function writeQueue(extra: Record<string, unknown>, queue: LifeQueueItem[]): Record<string, unknown> {
  return { ...extra, lifeNeedQueue: queue };
}

function readNextSpawn(extra: Record<string, unknown>): Partial<Record<LifeSimKind, string>> {
  const raw = extra.lifeNextSpawn;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<Record<LifeSimKind, string>> = {};
  for (const k of KINDS) {
    const s = o[k];
    if (typeof s === "string" && s.trim()) out[k] = s.trim();
  }
  return out;
}

function writeNextSpawn(
  extra: Record<string, unknown>,
  next: Partial<Record<LifeSimKind, string>>,
): Record<string, unknown> {
  return { ...extra, lifeNextSpawn: { ...readNextSpawn(extra), ...next } };
}

function countKind(queue: LifeQueueItem[], kind: LifeSimKind): number {
  return queue.filter((q) => q.kind === kind).length;
}

/**
 * Инициализация спавна и рейтинга, накопление событий в очередь, штрафы за просрочку.
 */
export function runLifeSimulationTick(
  extra: Record<string, unknown>,
  joinedAt: Date,
  now: Date,
  cfg: LifeSimulationResolvedConfig,
): { extra: Record<string, unknown>; dirty: boolean } {
  if (!cfg.enabled) return { extra, dirty: false };

  let e = { ...extra };
  let rating = readLifeRating(e, cfg);
  let dirty = false;

  if (e.lifeRating === undefined || e.lifeRating === null) {
    e = writeLifeRating(e, cfg.lifeInitial, cfg);
    rating = cfg.lifeInitial;
    dirty = true;
  }

  let queue = readLifeQueue(e);
  let nextSpawn = { ...readNextSpawn(e) };

  const joinedMs = joinedAt.getTime();
  if (Number.isNaN(joinedMs)) {
    return { extra: e, dirty };
  }

  for (const k of KINDS) {
    const h = cfg.intervalHours[k];
    if (!(h > 0)) continue;
    const intervalMs = h * 3_600_000;
    let tMs =
      typeof nextSpawn[k] === "string"
        ? new Date(nextSpawn[k]!).getTime()
        : Number.NaN;
    if (!Number.isFinite(tMs)) {
      tMs = joinedMs + intervalMs;
      nextSpawn[k] = new Date(tMs).toISOString();
      dirty = true;
    }

    while (tMs <= now.getTime() && countKind(queue, k) < cfg.maxQueuePerKind) {
      queue.push({
        id: makeId(),
        kind: k,
        spawnedAt: new Date(tMs).toISOString(),
        penalized: false,
      });
      tMs += intervalMs;
      dirty = true;
    }
    const nextIso = new Date(tMs).toISOString();
    if (nextSpawn[k] !== nextIso) {
      nextSpawn[k] = nextIso;
      dirty = true;
    }
  }

  const windowMs = cfg.responseWindowHours * 3_600_000;
  const nowMs = now.getTime();
  for (const item of queue) {
    if (item.penalized) continue;
    const spawned = new Date(item.spawnedAt).getTime();
    if (!Number.isFinite(spawned)) continue;
    if (nowMs > spawned + windowMs && cfg.missedPenalty > 0) {
      item.penalized = true;
      rating = clamp(rating - cfg.missedPenalty, cfg.lifeMin, cfg.lifeMax);
      dirty = true;
    }
  }

  e = writeNextSpawn(writeQueue(writeLifeRating(e, rating, cfg), queue), nextSpawn);

  return { extra: e, dirty };
}

export type FulfillAction = "feed" | "toilet" | "play" | "calm";

export function fulfillLifeQueueItem(
  extra: Record<string, unknown>,
  cfg: LifeSimulationResolvedConfig,
  action: FulfillAction,
  now: Date,
): { extra: Record<string, unknown>; lifeDelta: number; fulfilled: boolean } {
  if (!cfg.enabled) return { extra, lifeDelta: 0, fulfilled: false };
  const queue = readLifeQueue(extra);
  if (queue.length === 0) return { extra, lifeDelta: 0, fulfilled: false };
  const sorted = [...queue].sort(
    (a, b) => new Date(a.spawnedAt).getTime() - new Date(b.spawnedAt).getTime(),
  );
  const head = sorted[0]!;
  if (head.kind !== action) return { extra, lifeDelta: 0, fulfilled: false };
  const nextQueue = queue.filter((q) => q.id !== head.id);
  const item = head;
  const windowMs = cfg.responseWindowHours * 3_600_000;
  const spawned = new Date(item.spawnedAt).getTime();
  const onTime =
    !item.penalized && Number.isFinite(spawned) && now.getTime() <= spawned + windowMs;

  let delta = cfg.queueFulfillBonus;
  if (onTime) delta += cfg.onTimeBonus;

  const rating = readLifeRating(extra, cfg) + delta;
  let next = writeQueue(extra, nextQueue);
  next = writeLifeRating(next, rating, cfg);

  return { extra: next, lifeDelta: delta, fulfilled: true };
}

/** Бонус при переходе настроения в «happy» (максимальное для шкалы персонажа). */
export function applyLifeMoodPeakBonus(
  extra: Record<string, unknown>,
  cfg: LifeSimulationResolvedConfig,
  prevMood: string,
  newMood: string,
): { extra: Record<string, unknown>; delta: number } {
  if (!cfg.enabled || cfg.maxMoodBonus <= 0) return { extra, delta: 0 };
  if (prevMood === "happy" || newMood !== "happy") return { extra, delta: 0 };
  const rating = readLifeRating(extra, cfg) + cfg.maxMoodBonus;
  return { extra: writeLifeRating(extra, rating, cfg), delta: cfg.maxMoodBonus };
}

/** Самый ранний запрос в очереди (для подсказки действия). */
export function peekFirstLifeQueueAction(
  extra: Record<string, unknown>,
  cfg: LifeSimulationResolvedConfig,
): FulfillAction | null {
  if (!cfg.enabled) return null;
  const q = readLifeQueue(extra);
  if (q.length === 0) return null;
  const sorted = [...q].sort(
    (a, b) => new Date(a.spawnedAt).getTime() - new Date(b.spawnedAt).getTime()
  );
  return sorted[0]!.kind;
}

export function lifeQueueToPayload(
  queue: LifeQueueItem[],
  cfg: LifeSimulationResolvedConfig,
  now: Date,
): Array<{
  id: string;
  kind: LifeSimKind;
  spawnedAt: string;
  respondUntilAt: string;
  penalized: boolean;
  overdue: boolean;
}> {
  const windowMs = cfg.responseWindowHours * 3_600_000;
  const nowMs = now.getTime();
  return queue.map((q) => {
    const spawned = new Date(q.spawnedAt).getTime();
    const until = Number.isFinite(spawned) ? new Date(spawned + windowMs).toISOString() : q.spawnedAt;
    const overdue = !q.penalized && Number.isFinite(spawned) && nowMs > spawned + windowMs;
    return {
      id: q.id,
      kind: q.kind,
      spawnedAt: q.spawnedAt,
      respondUntilAt: until,
      penalized: q.penalized,
      overdue,
    };
  });
}
