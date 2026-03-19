import { API, API_BASE, apiFetch } from "@/lib/api-base";

export class CallTokenUnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "CallTokenUnauthorizedError";
  }
}

export async function getCallToken(): Promise<string> {
  const res = await apiFetch(`${API}/calls/token`, { method: "POST", suppressSessionExpireOn401: true });
  if (res.status === 401) throw new CallTokenUnauthorizedError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err?.message || "Не удалось получить токен звонка. Проверьте интернет.");
  }
  const data = (await res.json()) as { token: string };
  if (!data?.token) throw new Error("Сервер не вернул токен звонка");
  return data.token;
}

/**
 * База для WebSocket звонков:
 * 1) явный VITE_WS_URL (приоритет);
 * 2) API_BASE (критично для Capacitor, чтобы не уходить в ws://localhost);
 * 3) fallback на window.location.
 */
const WS_BASE = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_WS_URL) {
    return String(import.meta.env.VITE_WS_URL).replace(/\/$/, "");
  }
  if (API_BASE) return String(API_BASE).replace(/\/$/, "");
  return null;
})();

export function getCallWsUrl(token: string): string {
  if (WS_BASE) {
    const wsOrigin = WS_BASE.replace(/^https:\/\//i, "wss://");
    return `${wsOrigin}/calls?token=${encodeURIComponent(token)}`;
  }
  const base = typeof window !== "undefined" ? window.location : { protocol: "http:", host: "localhost" };
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3080";
  return `${protocol}//${host}/calls?token=${encodeURIComponent(token)}`;
}

/** Ограничения для getUserMedia: качественный звук (эхо/шум) и при необходимости видео. */
export function getMediaConstraints(video: boolean): MediaStreamConstraints {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // На iOS Safari/WebView sampleRate часто приводит к OverconstrainedError.
      ...(isIos ? {} : { sampleRate: 48000 }),
    },
    video: video
      ? {
          facingMode: "user",
          width: isIos ? { ideal: 960, min: 240 } : { ideal: 1280, min: 320 },
          height: isIos ? { ideal: 540, min: 180 } : { ideal: 720, min: 240 },
          frameRate: { ideal: 24, max: 30 },
        }
      : false,
  };
}

function preferPayloadInMLine(lines: string[], media: "audio" | "video", codecRegex: RegExp): string[] {
  const mLineIndex = lines.findIndex((l) => l.startsWith(`m=${media} `));
  if (mLineIndex < 0) return lines;
  const payloadOrder = lines[mLineIndex].split(" ");
  if (payloadOrder.length < 4) return lines;

  const preferredPayloads = lines
    .map((line) => {
      const m = line.match(codecRegex);
      return m?.[1] ?? null;
    })
    .filter((v): v is string => Boolean(v));
  if (!preferredPayloads.length) return lines;

  const header = payloadOrder.slice(0, 3);
  const payloads = payloadOrder.slice(3);
  const preferredSet = new Set(preferredPayloads);
  const first = payloads.filter((p) => preferredSet.has(p));
  const rest = payloads.filter((p) => !preferredSet.has(p));
  lines[mLineIndex] = [...header, ...first, ...rest].join(" ");
  return lines;
}

/**
 * SDP-трансформация для кросс-платформенных звонков:
 * - audio: предпочитаем opus
 * - video: предпочитаем H264 (особенно важно для iOS Safari/WebView)
 */
export function transformPeerSdp(sdp: string): string {
  const lines = sdp.split("\r\n");
  preferPayloadInMLine(lines, "audio", /^a=rtpmap:(\d+)\s+opus\/48000/i);
  preferPayloadInMLine(lines, "video", /^a=rtpmap:(\d+)\s+H264\/90000/i);
  return lines.join("\r\n");
}

/** ICE-серверы для WebRTC: STUN по умолчанию + опционально TURN из env (для симметричных NAT/файрволов). */
export function getIceServers(): RTCIceServer[] {
  const stun: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];
  const urlRaw = typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_URLS != null
    ? String(import.meta.env.VITE_TURN_URLS)
    : typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_URL != null
      ? String(import.meta.env.VITE_TURN_URL)
      : "";
  const urls = urlRaw ? urlRaw.split(",").map((u) => u.trim()).filter(Boolean) : [];
  if (urls.length === 0) return stun;
  const username = typeof import.meta?.env?.VITE_TURN_USERNAME === "string" ? import.meta.env.VITE_TURN_USERNAME : undefined;
  const credential = typeof import.meta?.env?.VITE_TURN_CREDENTIAL === "string" ? import.meta.env.VITE_TURN_CREDENTIAL : undefined;
  const turn: RTCIceServer = { urls, username, credential };
  return [...stun, turn];
}

export type CallSignalingMessage =
  | { type: "call-initiate"; video: boolean; chatId: string; fromUserId: string; fromDisplayName?: string }
  | { type: "call-accept"; video: boolean; fromUserId: string }
  | { type: "call-reject"; fromUserId: string }
  | { type: "call-end"; fromUserId: string }
  | { type: "target-waiting"; fromUserId: string; waitMs: number }
  | { type: "target-offline"; fromUserId: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; fromUserId: string };
