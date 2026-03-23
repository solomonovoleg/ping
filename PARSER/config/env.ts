/**
 * Окружение процесса PARSER (без импорта кода платформы).
 */

export function isNodeProduction(): boolean {
  return String(process.env.NODE_ENV).toLowerCase() === "production";
}

export function getListenPort(): number {
  const fromPort = Number(process.env.PORT);
  if (Number.isFinite(fromPort) && fromPort > 0) return fromPort;
  const p = Number(process.env.PARSER_PORT);
  if (Number.isFinite(p) && p > 0) return p;
  return 3093;
}

export function getBindHost(): string {
  const h = String(process.env.PARSER_BIND ?? "127.0.0.1").trim();
  return h || "127.0.0.1";
}

/** Секрет: вызовы с платформы и обратно на платформу (Bearer). */
export function getServiceSecret(): string | undefined {
  const s = process.env.PARSER_SERVICE_SECRET;
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > 0 ? t : undefined;
}

/** Та же БД, что у платформы (FK на users, posts). */
export function getParserDatabaseUrl(): string | undefined {
  const raw = process.env.PARSER_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw || typeof raw !== "string") return undefined;
  const u = raw.trim().replace(/^["']|["']$/g, "");
  if (!u) return undefined;
  return u.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432");
}

/** База URL основного приложения для POST /internal/parser/publish (loopback). */
export function getPlatformBaseUrl(): string {
  const raw = process.env.PARSER_PLATFORM_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  const port = Number(process.env.PLATFORM_PORT) || 3080;
  return `http://127.0.0.1:${port}`;
}

export function getParserPoolMax(): number {
  const n = Number(process.env.PARSER_PG_POOL_MAX);
  if (Number.isFinite(n) && n > 0) return Math.min(32, Math.floor(n));
  return 8;
}
