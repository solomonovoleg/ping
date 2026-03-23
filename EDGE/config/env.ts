/**
 * Конфигурация процесса EDGE (без зависимости от платформы).
 */

export function getListenPort(): number {
  const fromPort = Number(process.env.PORT);
  if (Number.isFinite(fromPort) && fromPort > 0) return fromPort;
  const fromEdge = Number(process.env.EDGE_PORT);
  if (Number.isFinite(fromEdge) && fromEdge > 0) return fromEdge;
  return 3092;
}

export function getBindHost(): string {
  const h = String(process.env.EDGE_BIND ?? "127.0.0.1").trim();
  return h || "127.0.0.1";
}

/** Секрет для вызовов с платформы (опционально в dev). */
export function getServiceSecret(): string | undefined {
  const s = process.env.EDGE_SERVICE_SECRET;
  const t = typeof s === "string" ? s.trim() : "";
  return t.length > 0 ? t : undefined;
}

/** Отдельная БД EDGE (рекомендуется). Без URL — только in-memory fallback в сервисах. */
export function getEdgeDatabaseUrl(): string | undefined {
  const raw = process.env.EDGE_DATABASE_URL;
  if (!raw || typeof raw !== "string") return undefined;
  const u = raw.trim().replace(/^["']|["']$/g, "");
  if (!u) return undefined;
  return u.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432");
}
