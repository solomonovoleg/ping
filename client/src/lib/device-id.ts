/** Должен совпадать с `PING_DEVICE_ID_COOKIE` на сервере (`server/auth/signup-signals.ts`). */
export const PING_DEVICE_ID_COOKIE = "pm_device_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(";")) {
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

/**
 * Стабильный ID установки браузера (first-party cookie). Нужен, чтобы отличить «10 регистраций с одного ПК»
 * от «2–3 человека за одним Wi‑Fi» (общий только IP).
 */
export function ensureDeviceIdCookie(): string {
  if (typeof document === "undefined") return "";
  const existing = readCookie(PING_DEVICE_ID_COOKIE);
  if (existing && UUID_RE.test(existing)) return existing;
  const id = randomUuidV4();
  const maxAge = 400 * 24 * 60 * 60;
  document.cookie = `${PING_DEVICE_ID_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  return id;
}

export function collectClientSignalsForSignup(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  const languages =
    typeof navigator.languages !== "undefined" && navigator.languages.length > 0
      ? [...navigator.languages]
      : null;
  const screenInfo =
    typeof globalThis.screen !== "undefined"
      ? {
          w: globalThis.screen.width,
          h: globalThis.screen.height,
          dpr: window.devicePixelRatio ?? 1,
        }
      : null;
  let isNative = false;
  try {
    const Cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    isNative = Cap?.isNativePlatform?.() === true;
  } catch {
    /* */
  }
  const out: Record<string, unknown> = {
    timeZone,
    language: navigator.language || null,
    languages,
    hardwareConcurrency:
      typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
    maxTouchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
    screen: screenInfo,
    isNative,
  };
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData && typeof uaData.platform === "string") out.platform = uaData.platform;
  return out;
}
