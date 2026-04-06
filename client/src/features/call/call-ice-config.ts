/**
 * ICE servers config + media constraints + SDP transform.
 * Extracted from the old lib/calls.ts to keep webrtc-peer.ts focused.
 */

import type { CallOutgoingVideoQuality } from "./call-types";

let warnedNoTurnBundled = false;
let warnedTurnWithoutCreds = false;
let warnedTurnTopology = false;

function analyzeTurnUrls(urls: string[]): {
  hosts: Set<string>;
  hasUdp: boolean;
  hasTcp: boolean;
  hasTls: boolean;
} {
  const hosts = new Set<string>();
  let hasUdp = false;
  let hasTcp = false;
  let hasTls = false;
  for (const raw of urls) {
    const value = raw.trim();
    const m = value.match(/^turns?:([^?]+)/i);
    if (m?.[1]) {
      const host = m[1].split(":")[0]?.trim();
      if (host) hosts.add(host);
    }
    if (/^turns:/i.test(value)) hasTls = true;
    if (/transport=udp/i.test(value)) hasUdp = true;
    if (/transport=tcp/i.test(value)) hasTcp = true;
  }
  return { hosts, hasUdp, hasTcp, hasTls };
}

export function getIceServers(): RTCIceServer[] {
  const stun: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];
  const urlRaw =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_URLS != null
      ? String(import.meta.env.VITE_TURN_URLS)
      : typeof import.meta !== "undefined" && import.meta.env?.VITE_TURN_URL != null
        ? String(import.meta.env.VITE_TURN_URL)
        : "";
  const urls = urlRaw ? urlRaw.split(",").map((u) => u.trim()).filter(Boolean) : [];
  if (urls.length === 0) {
    if (typeof window !== "undefined" && !warnedNoTurnBundled) {
      warnedNoTurnBundled = true;
      console.warn(
        "[call-ice] В этой сборке нет VITE_TURN_URLS/VITE_TURN_URL — только публичный STUN. За NAT/мобильным интернетом WebRTC часто не поднимается. Проверь deploy.env и npm run deploy.",
      );
    }
    return stun;
  }

  const userRaw =
    typeof import.meta?.env?.VITE_TURN_USERNAME === "string" ? import.meta.env.VITE_TURN_USERNAME.trim() : "";
  const passRaw =
    typeof import.meta?.env?.VITE_TURN_CREDENTIAL === "string" ? import.meta.env.VITE_TURN_CREDENTIAL.trim() : "";
  /** lt-cred-mech (coturn): нужны оба поля; иначе не передаём — иначе браузер шлёт пустой пароль. */
  const useCreds = userRaw.length > 0 && passRaw.length > 0;
  if (!useCreds && (userRaw.length > 0 || passRaw.length > 0) && import.meta.env?.DEV) {
    console.warn(
      "[call-ice] Задан только VITE_TURN_USERNAME или только VITE_TURN_CREDENTIAL — для TURN нужны оба; креды не передаём.",
    );
  }
  if (!useCreds && typeof window !== "undefined" && !warnedTurnWithoutCreds) {
    warnedTurnWithoutCreds = true;
    console.warn(
      "[call-ice] TURN URLs есть, но не задана пара VITE_TURN_USERNAME + VITE_TURN_CREDENTIAL — coturn (lt-cred-mech) не отдаст relay, звонок может не пройти.",
    );
  }

  const turnEntry: RTCIceServer = { urls, ...(useCreds ? { username: userRaw, credential: passRaw } : {}) };
  const turnTopology = analyzeTurnUrls(urls);
  if (
    typeof window !== "undefined" &&
    import.meta.env?.PROD &&
    !warnedTurnTopology &&
    (turnTopology.hosts.size < 2 || !turnTopology.hasUdp || !turnTopology.hasTcp || !turnTopology.hasTls)
  ) {
    warnedTurnTopology = true;
    console.warn(
      "[call-ice] TURN topology is minimal. Рекомендуется 2+ host и udp+tcp+turns(443) для стабильных LTE/VPN сценариев.",
      {
        hosts: Array.from(turnTopology.hosts),
        hasUdp: turnTopology.hasUdp,
        hasTcp: turnTopology.hasTcp,
        hasTls: turnTopology.hasTls,
      },
    );
  }
  /** TURN первым — быстрее появляются relay-кандидаты (важно для LTE ↔ Wi‑Fi). */
  return [turnEntry, ...stun];
}

function iceServerHasTurnWithCreds(s: RTCIceServer): boolean {
  const raw = s.urls;
  const list = Array.isArray(raw) ? raw : [raw];
  const hasTurn = list.some((u) => typeof u === "string" && /^turns?:/i.test(u));
  return hasTurn && Boolean(s.username && s.credential);
}

export type CallRtcTopology = "1to1" | "group";

/**
 * Конфиг RTCPeerConnection для звонков.
 * - `1to1`: в **production**, если TURN с кредами, по умолчанию `iceTransportPolicy: "relay"` —
 *   весь медиа-трафик через TURN (стабильно при разных сетях: Wi‑Fi ↔ LTE, жёсткий NAT).
 *   Отключить: `VITE_CALLS_ALLOW_P2P_ICE=1` (разрешить прямой P2P/STUN где получится).
 * - `group`: relay не форсируем (mesh × N сильно грузит TURN).
 */
export function getCallRtcConfiguration(topology: CallRtcTopology = "1to1"): RTCConfiguration {
  const iceServers = getIceServers();
  const hasTurnCreds = iceServers.some(iceServerHasTurnWithCreds);
  const allowP2pIce =
    import.meta.env.VITE_CALLS_ALLOW_P2P_ICE === "1" || import.meta.env.VITE_CALLS_ALLOW_P2P_ICE === "true";

  const cfg: RTCConfiguration = {
    iceServers,
    iceCandidatePoolSize: topology === "group" ? 4 : 10,
  };

  const forceRelay =
    topology === "1to1" && hasTurnCreds && import.meta.env.PROD && !allowP2pIce;
  if (forceRelay) {
    cfg.iceTransportPolicy = "relay";
  }

  return cfg;
}

/** iOS / Android: обычно есть «селфи»-камера и facingMode уместен. Десктоп (Chrome, Яндекс.Браузер): webcam часто без facing → OverconstrainedError при facingMode:user. */
export function isMobileCaptureProfile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Цепочка getUserMedia для видеозвонка: от самых совместимых к «тяжёлым».
 * Десктоп — сначала { video: true }, без facingMode в getMediaConstraints.
 */
export function getVideoCallGetUserMediaAttempts(opts?: { highQuality?: boolean }): MediaStreamConstraints[] {
  const mobile = isMobileCaptureProfile();
  const base: MediaStreamConstraints[] = mobile
    ? [
        { audio: true, video: { facingMode: "user" } },
        { audio: true, video: true },
        getMediaConstraints(true),
      ]
    : [{ audio: true, video: true }, getMediaConstraints(true)];
  if (opts?.highQuality === true) {
    base.push(getMediaConstraints(true, { highQuality: true }));
  }
  return base;
}

export function getMediaConstraints(
  video: boolean,
  opts?: { highQuality?: boolean },
): MediaStreamConstraints {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  /** На ПК не требуем facingMode — иначе частый отказ в Chrome / Яндекс.Браузере. */
  const useFacingModeOnVideo = isIos || isAndroid;
  const hq = opts?.highQuality === true && !isIos;
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: { ideal: 1 },
      /** Жёсткий sampleRate: 48000 ломал часть десктопных устройств; ideal достаточно для Opus. */
      ...(isIos ? {} : { sampleRate: { ideal: 48000 } }),
    },
    video: video
      ? {
          ...(useFacingModeOnVideo ? { facingMode: "user" as const } : {}),
          width: isIos
            ? { ideal: 1280, min: 240 }
            : hq
              ? { ideal: 1920, min: 640 }
              : { ideal: 1280, min: 320 },
          height: isIos
            ? { ideal: 720, min: 180 }
            : hq
              ? { ideal: 1080, min: 360 }
              : { ideal: 720, min: 240 },
          frameRate: { ideal: 30, max: 30 },
        }
      : false,
  };
}

/** Ограничения захвата камеры под профиль качества (после звонка — через applyConstraints). */
export function getVideoTrackQualityConstraints(quality: CallOutgoingVideoQuality): MediaTrackConstraints {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  if (isIos) {
    if (quality === "high") {
      return { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 30 } };
    }
    if (quality === "medium") {
      return { width: { ideal: 960, max: 1280 }, height: { ideal: 540, max: 720 }, frameRate: { ideal: 24, max: 30 } };
    }
    return { width: { ideal: 640, max: 960 }, height: { ideal: 360, max: 540 }, frameRate: { ideal: 15, max: 24 } };
  }
  if (quality === "high") {
    return { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } };
  }
  if (quality === "medium") {
    return { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } };
  }
  return { width: { ideal: 640, max: 960 }, height: { ideal: 360, max: 540 }, frameRate: { ideal: 15, max: 20 } };
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

/** Prefer opus for audio, H264 for video (important for iOS Safari/WebView). */
export function transformSdp(sdp: string): string {
  const lines = sdp.split("\r\n");
  preferPayloadInMLine(lines, "audio", /^a=rtpmap:(\d+)\s+opus\/48000/i);
  preferPayloadInMLine(lines, "video", /^a=rtpmap:(\d+)\s+H264\/90000/i);
  return lines.join("\r\n");
}
