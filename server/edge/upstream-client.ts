/**
 * Опциональный вызов микросервиса EDGE. Без URL — платформа не ходит наружу.
 */

import { outgoingRequestIdHeaders } from "../lib/outgoing-request-id";

function trimUrl(base: string | undefined): string | null {
  if (!base || typeof base !== "string") return null;
  const t = base.trim().replace(/\/$/, "");
  return t.length > 0 ? t : null;
}

export function getEdgeUpstreamBase(): string | null {
  return trimUrl(process.env.EDGE_UPSTREAM_URL) || trimUrl(process.env.EDGE_URL);
}

export function getEdgeProxyTimeoutMs(): number {
  const n = Number(process.env.EDGE_PROXY_TIMEOUT_MS);
  if (Number.isFinite(n) && n > 0) return Math.min(n, 30_000);
  return 2500;
}

/** Ограничение чтения тела ответа после headers (fetch-таймаут может уже сработать, а `r.text()` ещё висит). */
export function getEdgeUpstreamBodyReadTimeoutMs(): number {
  const base = getEdgeProxyTimeoutMs();
  return Math.min(30_000, Math.max(2000, base));
}

async function readResponseTextWithTimeout(r: Response, ms: number): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("upstream_body_timeout")), ms);
  });
  try {
    return await Promise.race([r.text(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getEdgeServiceSecretHeader(): Record<string, string> {
  const s = process.env.EDGE_SERVICE_SECRET;
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export async function edgeUpstreamReachable(): Promise<boolean> {
  const base = getEdgeUpstreamBase();
  if (!base) return false;
  const ac = new AbortController();
  const ms = Math.min(getEdgeProxyTimeoutMs(), 2000);
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(`${base}/v1/health`, { signal: ac.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export type UpstreamCampaignResult =
  | { ok: true; status: number; body: string }
  | { ok: false };

export async function fetchUpstreamCampaignConfig(edgeId: string, requestId?: string): Promise<UpstreamCampaignResult> {
  const base = getEdgeUpstreamBase();
  if (!base) return { ok: false };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), getEdgeProxyTimeoutMs());
  try {
    const qs = new URLSearchParams({ edgeId });
    const r = await fetch(`${base}/v1/companion/campaign-config?${qs.toString()}`, {
      signal: ac.signal,
      headers: {
        ...getEdgeServiceSecretHeader(),
        ...outgoingRequestIdHeaders(requestId),
      },
    });
    const body = await readResponseTextWithTimeout(r, getEdgeUpstreamBodyReadTimeoutMs());
    return { ok: true, status: r.status, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchUpstreamMoneyCampaignConfig(edgeId: string, requestId?: string): Promise<UpstreamCampaignResult> {
  const base = getEdgeUpstreamBase();
  if (!base) return { ok: false };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), getEdgeProxyTimeoutMs());
  try {
    const qs = new URLSearchParams({ edgeId });
    const r = await fetch(`${base}/v1/money/campaign-config?${qs.toString()}`, {
      signal: ac.signal,
      headers: {
        ...getEdgeServiceSecretHeader(),
        ...outgoingRequestIdHeaders(requestId),
      },
    });
    const body = await readResponseTextWithTimeout(r, getEdgeUpstreamBodyReadTimeoutMs());
    return { ok: true, status: r.status, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

type UpstreamParticipantOpts = {
  method: "GET" | "POST" | "PATCH";
  platformUserId: string;
  body?: string;
  requestId?: string;
  /** Доп. заголовки к EDGE (например служебные — не из браузера). */
  extraHeaders?: Record<string, string>;
};

/** Пути вида `/v1/participant/state?edgeId=…` — только server-to-server с секретом. */
/** Вызов EDGE только с секретом (без X-Platform-User-Id), например розыгрыш призов. */
export async function fetchUpstreamEdgeServicePath(
  pathAndQuery: string,
  opts: { method: "GET" | "POST"; body?: string; requestId?: string },
): Promise<UpstreamCampaignResult> {
  const base = getEdgeUpstreamBase();
  if (!base) return { ok: false };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), getEdgeProxyTimeoutMs());
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  try {
    const headers: Record<string, string> = {
      ...getEdgeServiceSecretHeader(),
      ...outgoingRequestIdHeaders(opts.requestId),
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    const r = await fetch(`${base}${path}`, {
      method: opts.method,
      signal: ac.signal,
      headers,
      body: opts.body,
    });
    const body = await readResponseTextWithTimeout(r, getEdgeUpstreamBodyReadTimeoutMs());
    return { ok: true, status: r.status, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchUpstreamParticipantPath(
  pathAndQuery: string,
  opts: UpstreamParticipantOpts,
): Promise<UpstreamCampaignResult> {
  const base = getEdgeUpstreamBase();
  if (!base) return { ok: false };
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), getEdgeProxyTimeoutMs());
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  try {
    const headers: Record<string, string> = {
      ...getEdgeServiceSecretHeader(),
      ...outgoingRequestIdHeaders(opts.requestId),
      "X-Platform-User-Id": opts.platformUserId,
      ...(opts.extraHeaders ?? {}),
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    const r = await fetch(`${base}${path}`, {
      method: opts.method,
      signal: ac.signal,
      headers,
      body: opts.body,
    });
    const body = await readResponseTextWithTimeout(r, getEdgeUpstreamBodyReadTimeoutMs());
    return { ok: true, status: r.status, body };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}
