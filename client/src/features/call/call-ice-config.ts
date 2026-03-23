/**
 * ICE servers config + media constraints + SDP transform.
 * Extracted from the old lib/calls.ts to keep webrtc-peer.ts focused.
 */

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
  if (urls.length === 0) return stun;

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

  return [...stun, { urls, ...(useCreds ? { username: userRaw, credential: passRaw } : {}) }];
}

export function getMediaConstraints(
  video: boolean,
  opts?: { highQuality?: boolean },
): MediaStreamConstraints {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const hq = opts?.highQuality === true && !isIos;
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: { ideal: 1 },
      ...(isIos ? {} : { sampleRate: 48000 }),
    },
    video: video
      ? {
          facingMode: "user",
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
