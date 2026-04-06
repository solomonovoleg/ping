import type { NextFunction, Request, Response } from "express";
import { getUserId } from "../auth/session";

const WINDOW_MS = 60_000;

/** Бывшие пороги API-shield (для экрана админки / справки); лимитирование отключено. */
const LIMIT_ANON_READ_NORMAL = 6000;
const LIMIT_ANON_READ_STRICT = 2500;
const LIMIT_AUTH_READ_NORMAL = 12000;
const LIMIT_AUTH_READ_STRICT = 6000;
const LIMIT_ANON_MUTATION_NORMAL = 4000;
const LIMIT_ANON_MUTATION_STRICT = 1500;
const LIMIT_AUTH_MUTATION_NORMAL = 8000;
const LIMIT_AUTH_MUTATION_STRICT = 4000;

const HISTORY_MINUTES = 90;
const buckets = new Map<
  number,
  { total: number; anonymous: number; authenticated: number; limited429: number }
>();

/** После смены настроек платформы; раньше сбрасывала кеш strict shield. */
export function invalidateApiShieldSettingsCache(): void {}

function currentMinuteKey(): number {
  return Math.floor(Date.now() / 60_000);
}

function pruneBuckets(): void {
  const minKeep = currentMinuteKey() - HISTORY_MINUTES;
  for (const k of buckets.keys()) {
    if (k < minKeep) buckets.delete(k);
  }
}

function touchBucket(): { total: number; anonymous: number; authenticated: number; limited429: number } {
  const m = currentMinuteKey();
  let b = buckets.get(m);
  if (!b) {
    b = { total: 0, anonymous: 0, authenticated: 0, limited429: 0 };
    buckets.set(m, b);
    pruneBuckets();
  }
  return b;
}

export function recordApiTrafficHit(req: Request): void {
  const uid = getUserId(req);
  const b = touchBucket();
  b.total += 1;
  if (uid) b.authenticated += 1;
  else b.anonymous += 1;
}

export function recordApiTraffic429(): void {
  const b = touchBucket();
  b.limited429 += 1;
}

export function apiTrafficRecordMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const path = req.originalUrl.split("?")[0] || "";
  if (!path.startsWith("/api")) {
    next();
    return;
  }
  if (path.startsWith("/api/admin")) {
    next();
    return;
  }
  recordApiTrafficHit(req);
  next();
}

export type TrafficShieldMinute = {
  minute: number;
  total: number;
  anonymous: number;
  authenticated: number;
  limited429: number;
};

export function getTrafficShieldAdminPayload(): {
  generatedAt: string;
  strictApiShield: boolean;
  windowMs: number;
  limits: {
    read: {
      anonymousNormal: number;
      anonymousStrict: number;
      authenticatedNormal: number;
      authenticatedStrict: number;
    };
    mutation: {
      anonymousNormal: number;
      anonymousStrict: number;
      authenticatedNormal: number;
      authenticatedStrict: number;
    };
  };
  currentMinute: TrafficShieldMinute | null;
  history: TrafficShieldMinute[];
  uptimeSec: number;
  note: string;
} {
  const nowKey = currentMinuteKey();
  const keys = [...buckets.keys()].filter((k) => k >= nowKey - HISTORY_MINUTES).sort((a, b) => a - b);
  const history: TrafficShieldMinute[] = keys.map((k) => {
    const b = buckets.get(k)!;
    return { minute: k, ...b };
  });
  const cur = buckets.get(nowKey);
  return {
    generatedAt: new Date().toISOString(),
    strictApiShield: false,
    windowMs: WINDOW_MS,
    limits: {
      read: {
        anonymousNormal: LIMIT_ANON_READ_NORMAL,
        anonymousStrict: LIMIT_ANON_READ_STRICT,
        authenticatedNormal: LIMIT_AUTH_READ_NORMAL,
        authenticatedStrict: LIMIT_AUTH_READ_STRICT,
      },
      mutation: {
        anonymousNormal: LIMIT_ANON_MUTATION_NORMAL,
        anonymousStrict: LIMIT_ANON_MUTATION_STRICT,
        authenticatedNormal: LIMIT_AUTH_MUTATION_NORMAL,
        authenticatedStrict: LIMIT_AUTH_MUTATION_STRICT,
      },
    },
    currentMinute: cur
      ? { minute: nowKey, total: cur.total, anonymous: cur.anonymous, authenticated: cur.authenticated, limited429: cur.limited429 }
      : null,
    history,
    uptimeSec: Math.round(process.uptime()),
    note:
      "Серверные rate-limit на /api отключены. Ниже — прежние пороги для справки; фактический strictApiShield — из настроек платформы. Анти-DDoS — nginx/CDN.",
  };
}
