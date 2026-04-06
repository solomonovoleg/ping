import { createHash } from "crypto";
import type { Request } from "express";

/** Должен совпадать с `PING_DEVICE_ID_COOKIE` на клиенте (`client/src/lib/device-id.ts`). */
export const PING_DEVICE_ID_COOKIE = "pm_device_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== "string") return null;
  const prefix = `${name}=`;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (!p.startsWith(prefix)) continue;
    const v = p.slice(prefix.length);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}

function headerString(req: Request, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v.join(", ");
  return null;
}

function normalizeClientSignals(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof raw.timeZone === "string") out.timeZone = truncate(raw.timeZone, 80);
  if (typeof raw.language === "string") out.language = truncate(raw.language, 64);
  if (Array.isArray(raw.languages)) {
    out.languages = raw.languages
      .filter((x): x is string => typeof x === "string")
      .slice(0, 8)
      .map((x) => truncate(x, 64));
  }
  if (typeof raw.hardwareConcurrency === "number" && Number.isFinite(raw.hardwareConcurrency)) {
    out.hardwareConcurrency = Math.max(0, Math.min(256, Math.floor(raw.hardwareConcurrency)));
  }
  if (typeof raw.maxTouchPoints === "number" && Number.isFinite(raw.maxTouchPoints)) {
    out.maxTouchPoints = Math.max(0, Math.min(32, Math.floor(raw.maxTouchPoints)));
  }
  if (raw.screen && typeof raw.screen === "object" && raw.screen !== null) {
    const s = raw.screen as Record<string, unknown>;
    const w = typeof s.w === "number" && Number.isFinite(s.w) ? Math.max(0, Math.min(16384, Math.floor(s.w))) : null;
    const h = typeof s.h === "number" && Number.isFinite(s.h) ? Math.max(0, Math.min(16384, Math.floor(s.h))) : null;
    const dpr =
      typeof s.dpr === "number" && Number.isFinite(s.dpr) ? Math.max(0.5, Math.min(16, s.dpr)) : null;
    if (w != null || h != null || dpr != null) out.screen = { w, h, dpr };
  }
  if (typeof raw.platform === "string") out.platform = truncate(raw.platform, 64);
  if (typeof raw.isNative === "boolean") out.isNative = raw.isNative;
  if (typeof raw.appId === "string") out.appId = truncate(raw.appId, 64);
  return out;
}

export type SignupTelemetryInsert = {
  signupIp: string | null;
  signupForwardedFor: string | null;
  signupUserAgent: string | null;
  signupUaHash: string | null;
  signupAcceptLanguage: string | null;
  signupSecChUa: string | null;
  signupSecChUaMobile: string | null;
  signupSecChUaPlatform: string | null;
  signupReferer: string | null;
  signupOrigin: string | null;
  signupDeviceId: string | null;
  signupClientSignalsHash: string | null;
  signupClientSignalsJson: string | null;
};

/**
 * Собирает сигналы регистрации: заголовки запроса, cookie устройства, опционально clientSignals из JSON body.
 * Не содержит PII кроме IP/UA (для модерации); хеши — для группировки.
 */
export function extractSignupTelemetry(req: Request, body: unknown): SignupTelemetryInsert {
  const ipRaw =
    typeof req.ip === "string" && req.ip.trim()
      ? req.ip.trim()
      : req.socket.remoteAddress?.trim() || null;
  const signupIp = ipRaw ? truncate(ipRaw, 64) : null;

  const xff = headerString(req, "x-forwarded-for");
  const signupForwardedFor = xff ? truncate(xff, 512) : null;

  const ua = headerString(req, "user-agent");
  const signupUserAgent = ua ? truncate(ua, 900) : null;
  const signupUaHash = ua ? sha256Hex(ua) : null;

  const al = headerString(req, "accept-language");
  const signupAcceptLanguage = al ? truncate(al, 256) : null;

  const chUa = headerString(req, "sec-ch-ua");
  const signupSecChUa = chUa ? truncate(chUa, 512) : null;
  const chMob = headerString(req, "sec-ch-ua-mobile");
  const signupSecChUaMobile = chMob ? truncate(chMob, 32) : null;
  const chPlat = headerString(req, "sec-ch-ua-platform");
  const signupSecChUaPlatform = chPlat ? truncate(chPlat, 256) : null;

  const ref = headerString(req, "referer");
  const signupReferer = ref ? truncate(ref, 512) : null;
  const origin = headerString(req, "origin");
  const signupOrigin = origin ? truncate(origin, 256) : null;

  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fromBody = typeof b.deviceId === "string" ? b.deviceId.trim() : "";
  const fromCookie = readCookie(req, PING_DEVICE_ID_COOKIE)?.trim() ?? "";
  const deviceCandidate = fromBody || fromCookie;
  const signupDeviceId =
    deviceCandidate && UUID_RE.test(deviceCandidate) ? truncate(deviceCandidate, 128) : null;

  let signupClientSignalsHash: string | null = null;
  let signupClientSignalsJson: string | null = null;
  const cs = b.clientSignals;
  if (cs && typeof cs === "object" && cs !== null) {
    const norm = normalizeClientSignals(cs as Record<string, unknown>);
    const json = JSON.stringify(norm);
    if (json !== "{}") {
      signupClientSignalsJson = truncate(json, 2000);
      signupClientSignalsHash = sha256Hex(json);
    }
  }

  return {
    signupIp,
    signupForwardedFor,
    signupUserAgent,
    signupUaHash,
    signupAcceptLanguage,
    signupSecChUa,
    signupSecChUaMobile,
    signupSecChUaPlatform,
    signupReferer,
    signupOrigin,
    signupDeviceId,
    signupClientSignalsHash,
    signupClientSignalsJson,
  };
}
