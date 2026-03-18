import { API, API_BASE, apiFetch } from "@/lib/api-base";

export class CallTokenUnauthorizedError extends Error {
  constructor() {
    super("UNAUTHORIZED");
    this.name = "CallTokenUnauthorizedError";
  }
}

export async function getCallToken(): Promise<string> {
  const res = await apiFetch(`${API}/calls/token`, { method: "POST" });
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
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
    },
    video: video
      ? {
          facingMode: "user",
          width: { ideal: 1280, min: 320 },
          height: { ideal: 720, min: 240 },
          frameRate: { ideal: 24, max: 30 },
        }
      : false,
  };
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
  | { type: "target-offline"; fromUserId: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; fromUserId: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; fromUserId: string };
