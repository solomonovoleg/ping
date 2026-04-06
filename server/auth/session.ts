/** Сессия + приоритет над Bearer: `docs/API_AUTH_AND_PUBLIC.md`. */
import session from "express-session";
import type { Express, Request, Response, NextFunction } from "express";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { getUserIdByToken } from "./token";
import { getPool } from "../db/client";

const MemoryStoreClass = MemoryStore(session);
const PgStore = connectPgSimple(session);

function resolveRequiredSecret(envName: string, opts?: { minLength?: number; allowDevFallback?: string }): string {
  const minLength = opts?.minLength ?? 24;
  const raw = process.env[envName]?.trim();
  if (raw && raw.length >= minLength) return raw;
  if (process.env.ALLOW_INSECURE_SECRETS === "1" && opts?.allowDevFallback) {
    console.warn(`[security] ${envName} is weak or missing, using insecure fallback (ALLOW_INSECURE_SECRETS=1).`);
    return opts.allowDevFallback;
  }
  throw new Error(
    `[security] ${envName} must be set and at least ${minLength} chars. ` +
      `Set ALLOW_INSECURE_SECRETS=1 only for local development.`,
  );
}

function parseSessionMaxAgeDays(): number {
  const raw = process.env.SESSION_MAX_AGE_DAYS?.trim();
  if (!raw) return 31;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 31;
  return Math.min(400, Math.max(1, n));
}

const SESSION_MAX_AGE_DAYS = parseSessionMaxAgeDays();
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
/** connect-pg-simple: если в сохранённом sess нет cookie.expires, TTL в БД = ttl || 1 день — задаём явно под maxAge куки */
const SESSION_STORE_TTL_SEC = Math.floor(SESSION_MAX_AGE_MS / 1000);

/** Таблица для connect-pg-simple. Вызывать при старте приложения, если используем PostgreSQL. */
export async function ensureSessionTable(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes("placeholder")) return;
  try {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL,
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        PRIMARY KEY ("sid")
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
    console.log("[session] Table session ready");
  } catch (e) {
    console.error("[session] ensureSessionTable failed:", (e as Error).message);
  }
}

/** Сессии в PostgreSQL переживают рестарт сервера (деплой). Если DATABASE_URL нет — fallback на память. */
function createSessionStore(): session.Store {
  const url = process.env.DATABASE_URL?.trim();
  if (url && !url.includes("placeholder")) {
    try {
      const pool = getPool();
      return new PgStore({
        pool,
        createTableIfMissing: true,
        pruneSessionInterval: 60 * 15,
        ttl: SESSION_STORE_TTL_SEC,
      });
    } catch (e) {
      console.warn("[session] PostgreSQL store failed, using memory:", (e as Error).message);
    }
  }
  return new MemoryStoreClass({ checkPeriod: 86400000 });
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
    /** Админ вошёл через /api/admin/login (логин/пароль из env) */
    adminAuthenticated?: boolean;
  }
}

declare global {
  namespace Express {
    interface Request {
      authUserId?: string;
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.adminAuthenticated) {
    next();
  } else {
    res.status(403).json({ message: "Доступ только для администратора" });
  }
}

// secure: "auto" — express-session сам ставит Secure только по HTTPS (и по X-Forwarded-Proto за прокси).
// Иначе при secure: true по HTTP кука вообще не отправляется (middleware пропускает set-cookie) → сессия не сохраняется.
// Явно true/false через SESSION_SECURE по-прежнему поддерживаются.
const secureOption =
  process.env.SESSION_SECURE === "true"
    ? true
    : process.env.SESSION_SECURE === "false"
      ? false
      : ("auto" as const);
// sameSite: "none" нужен, если фронт и API на разных поддоменах; иначе "lax"
const sameSite = process.env.SESSION_SAME_SITE === "none" ? ("none" as const) : ("lax" as const);

const sessionCookieDomainRaw = process.env.SESSION_COOKIE_DOMAIN?.trim();
const sessionCookieDomain =
  sessionCookieDomainRaw && sessionCookieDomainRaw.length > 0 ? sessionCookieDomainRaw : undefined;

const sessionMiddleware = session({
  name: "ping.sid",
  store: createSessionStore(),
  secret: resolveRequiredSecret("SESSION_SECRET", {
    minLength: 24,
    allowDevFallback: "dev-insecure-session-secret-change-me",
  }),
  resave: false,
  saveUninitialized: false,
  proxy: true, // учитывать X-Forwarded-Proto за nginx, чтобы secure: "auto" работал
  rolling: true, // при каждом запросе с сессией продлевать срок жизни (кука и store)
  cookie: {
    secure: secureOption,
    httpOnly: true,
    sameSite,
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
    ...(sessionCookieDomain ? { domain: sessionCookieDomain } : {}),
  },
});

export function setupSession(app: Express): void {
  app.use(sessionMiddleware);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (token) req.authUserId = getUserIdByToken(token) ?? undefined;
    next();
  });
}

/** ID текущего пользователя: сессия (веб) или Bearer token (мобильное приложение). Сессия имеет приоритет. */
export function getUserId(req: Request): string | undefined {
  return req.session?.userId ?? req.authUserId;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.userId || req.authUserId) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}
