import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getUserId } from "../auth/session";
import { platformGetPublic } from "../admin/ops/platform.repo";

const WINDOW_MS = 60_000;

/**
 * Два независимых счётчика на ключ (IP / userId):
 * - **read** — только GET: высокий потолок (чат, уведомления, нервные обновления страницы).
 * - **mutation** — POST/PUT/PATCH/DELETE: умеренный потолок (спам действий).
 */
/** Неавторизованные GET: по IP. */
const LIMIT_ANON_READ_NORMAL = 480;
const LIMIT_ANON_READ_STRICT = 200;
/** Авторизованные GET: по userId — десятки параллельных запросов при одном F5 не упираются в 429. */
const LIMIT_AUTH_READ_NORMAL = 5000;
const LIMIT_AUTH_READ_STRICT = 2200;

/** Неавторизованные мутации: по IP. */
const LIMIT_ANON_MUTATION_NORMAL = 240;
const LIMIT_ANON_MUTATION_STRICT = 100;
/** Авторизованные мутации: по userId. */
const LIMIT_AUTH_MUTATION_NORMAL = 900;
const LIMIT_AUTH_MUTATION_STRICT = 360;

const HISTORY_MINUTES = 90;
const buckets = new Map<
  number,
  { total: number; anonymous: number; authenticated: number; limited429: number }
>();

let strictCache = false;
let strictCachedAt = 0;
const STRICT_CACHE_MS = 12_000;

export function invalidateApiShieldSettingsCache(): void {
  strictCachedAt = 0;
}

async function isStrictShieldEnabled(): Promise<boolean> {
  if (Date.now() - strictCachedAt < STRICT_CACHE_MS) return strictCache;
  try {
    const p = await platformGetPublic();
    strictCache = p.strictApiShield;
  } catch {
    strictCache = false;
  }
  strictCachedAt = Date.now();
  return strictCache;
}

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
  /** Админка не смешиваем с пользовательским трафиком — иначе полезёт в картину «боты». */
  if (path.startsWith("/api/admin")) {
    next();
    return;
  }
  recordApiTrafficHit(req);
  next();
}

function shieldSkipPath(path: string): boolean {
  if (path === "/api/build-info" || path === "/api/time") return true;
  if (path.startsWith("/api/auth/login") || path.startsWith("/api/auth/register")) return true;
  if (path.startsWith("/api/platform/")) return true;
  if (path.startsWith("/api/admin")) return true;
  return false;
}

const SHIELD_MSG = { message: "Слишком много запросов. Подождите минуту и попробуйте снова." };

function createShieldHandler() {
  return (req: Request, res: Response, _next: NextFunction, options: { statusCode: number; message: unknown }) => {
    recordApiTraffic429();
    res.status(options.statusCode).json(options.message);
  };
}

/** Лимит только на GET (чтение API). */
export function createApiShieldReadLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: async (req: Request) => {
      const strict = await isStrictShieldEnabled();
      const uid = getUserId(req);
      if (uid) return strict ? LIMIT_AUTH_READ_STRICT : LIMIT_AUTH_READ_NORMAL;
      return strict ? LIMIT_ANON_READ_STRICT : LIMIT_ANON_READ_NORMAL;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const uid = getUserId(req);
      if (uid) return `shield-read:u:${uid}`;
      return `shield-read:ip:${req.ip ?? "unknown"}`;
    },
    skip: (req: Request) => {
      const path = req.originalUrl.split("?")[0] || "";
      if (shieldSkipPath(path)) return true;
      if (req.method !== "GET") return true;
      return false;
    },
    message: SHIELD_MSG,
    handler: createShieldHandler(),
  });
}

/** Лимит на POST / PUT / PATCH / DELETE. */
export function createApiShieldMutationLimiter() {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: async (req: Request) => {
      const strict = await isStrictShieldEnabled();
      const uid = getUserId(req);
      if (uid) return strict ? LIMIT_AUTH_MUTATION_STRICT : LIMIT_AUTH_MUTATION_NORMAL;
      return strict ? LIMIT_ANON_MUTATION_STRICT : LIMIT_ANON_MUTATION_NORMAL;
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      const uid = getUserId(req);
      if (uid) return `shield-mut:u:${uid}`;
      return `shield-mut:ip:${req.ip ?? "unknown"}`;
    },
    skip: (req: Request) => {
      const path = req.originalUrl.split("?")[0] || "";
      if (shieldSkipPath(path)) return true;
      const m = req.method;
      if (m === "GET" || m === "HEAD" || m === "OPTIONS") return true;
      return false;
    },
    message: SHIELD_MSG,
    handler: createShieldHandler(),
  });
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
    strictApiShield: strictCache,
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
      "Два лимита в минуту на IP или userId: отдельно GET (чтение) и отдельно POST/PUT/PATCH/DELETE. Счётчики в памяти процесса (сброс при рестарте). При атаке с множества IP — nginx / CDN.",
  };
}
