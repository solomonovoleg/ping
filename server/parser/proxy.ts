import { outgoingRequestIdHeaders } from "../lib/outgoing-request-id";

function isProduction(): boolean {
  return String(process.env.NODE_ENV).toLowerCase() === "production";
}

let loggedDevParserFallback = false;

/** В development, если PARSER_UPSTREAM_URL не задан — ходим на локальный PARSER (как у `npm run dev:parser`). */
function defaultParserUpstreamDev(): string {
  const fromPort = Number(process.env.PARSER_PORT);
  const port = Number.isFinite(fromPort) && fromPort > 0 ? fromPort : 3093;
  return `http://127.0.0.1:${port}`;
}

function trimUrl(base: string | undefined): string | null {
  if (!base || typeof base !== "string") return null;
  const t = base.trim().replace(/\/$/, "");
  return t.length > 0 ? t : null;
}

/** Явно заданный в .env URL (без dev-fallback). Для предупреждения при старте в production. */
export function hasExplicitParserUpstreamEnv(): boolean {
  return trimUrl(process.env.PARSER_UPSTREAM_URL) != null;
}

export function getParserUpstreamBase(): string | null {
  const explicit = trimUrl(process.env.PARSER_UPSTREAM_URL);
  if (explicit) return explicit;
  if (isProduction()) return null;
  const url = defaultParserUpstreamDev();
  if (!loggedDevParserFallback) {
    loggedDevParserFallback = true;
    console.info(
      `[parser-proxy] PARSER_UPSTREAM_URL не задан — в development прокси идёт на ${url}. Запуск парсера: npm run dev:parser или npm run dev:with-parser`,
    );
  }
  return url;
}

export function getParserProxyTimeoutMs(): number {
  const n = Number(process.env.PARSER_PROXY_TIMEOUT_MS);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 60_000);
  return 25_000;
}

function getParserBodyReadTimeoutMs(): number {
  return Math.min(45_000, Math.max(3_000, getParserProxyTimeoutMs()));
}

async function readTextWithTimeout(response: Response, timeoutMs: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("parser_body_timeout")), timeoutMs);
  });
  try {
    return await Promise.race([response.text(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function parserUpstreamHeaders(): Record<string, string> {
  const s = process.env.PARSER_SERVICE_SECRET;
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export type ParserProxyResult = { ok: true; status: number; text: string } | { ok: false; status: number; text: string };

export async function proxyParserRequest(
  method: string,
  path: string,
  opts?: { body?: string; query?: string; requestId?: string },
): Promise<ParserProxyResult> {
  const base = getParserUpstreamBase();
  if (!base) {
    return {
      ok: false,
      status: 503,
      text: JSON.stringify({ message: "Парсер не настроен (PARSER_UPSTREAM_URL)" }),
    };
  }
  const sec = process.env.PARSER_SERVICE_SECRET?.trim();
  if (isProduction() && !sec) {
    return {
      ok: false,
      status: 503,
      text: JSON.stringify({
        message: "В production задайте PARSER_SERVICE_SECRET на платформе для прокси парсера",
      }),
    };
  }
  const q = opts?.query && opts.query.length > 0 ? `?${opts.query}` : "";
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}${q}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), getParserProxyTimeoutMs());
  try {
    const r = await fetch(url, {
      method,
      headers: {
        ...parserUpstreamHeaders(),
        ...outgoingRequestIdHeaders(opts?.requestId),
        ...(opts?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts?.body,
      signal: ac.signal,
    });
    const text = await readTextWithTimeout(r, getParserBodyReadTimeoutMs());
    return { ok: true, status: r.status, text };
  } catch {
    return {
      ok: false,
      status: 503,
      text: JSON.stringify({ message: "Парсер недоступен (timeout или сеть)" }),
    };
  } finally {
    clearTimeout(t);
  }
}

export function sendParserProxyResponse(
  res: import("express").Response,
  pr: ParserProxyResult,
): void {
  const payload = pr.text;
  let ct = "application/json";
  try {
    JSON.parse(payload);
  } catch {
    ct = "text/plain; charset=utf-8";
  }
  res.status(pr.status);
  if (ct.startsWith("application/json")) {
    try {
      res.json(JSON.parse(payload));
    } catch {
      res.type("json").send(payload);
    }
  } else {
    res.type("text/plain").send(payload);
  }
}
