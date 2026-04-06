/**
 * Единый способ «попросить» доступ к микрофону/камере и сразу отпустить устройство.
 * Браузер запоминает разрешение для origin; важно вызывать getUserMedia с одними и теми же
 * смысловыми constraints (как при звонках), иначе часть движков ведёт себя как новый запрос.
 */
import {
  getMediaConstraints,
  getVideoCallGetUserMediaAttempts,
  isMobileCaptureProfile,
} from "@/features/call/call-ice-config";

export type MediaPrimeResult = "granted" | "denied" | "unavailable";

function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}

async function queryMicGranted(): Promise<boolean> {
  try {
    const q = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return q.state === "granted";
  } catch {
    return false;
  }
}

async function queryCameraGranted(): Promise<boolean> {
  try {
    const q = await navigator.permissions.query({ name: "camera" as PermissionName });
    return q.state === "granted";
  } catch {
    return false;
  }
}

let sessionMicPrimed = false;
let sessionAvPrimed = false;

/** Один запрос микрофона с теми же настройками, что у звонков и записи ГС; треки сразу останавливаем. */
export async function primeMicrophoneCapture(): Promise<MediaPrimeResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }
  if (sessionMicPrimed) return "granted";
  if (await queryMicGranted()) {
    sessionMicPrimed = true;
    return "granted";
  }
  const micAttempts: MediaStreamConstraints[] = isMobileCaptureProfile()
    ? [getMediaConstraints(false), { audio: true, video: false }]
    : [{ audio: true, video: false }, getMediaConstraints(false)];
  try {
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const c of micAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!stream) {
      const name = lastErr instanceof Error ? lastErr.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
      return "unavailable";
    }
    stopTracks(stream);
    sessionMicPrimed = true;
    return "granted";
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
    return "unavailable";
  }
}

/** Микрофон + камера (для видеозвонков / съёмки в вебе). */
export async function primeCameraAndMicrophoneCapture(): Promise<MediaPrimeResult> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unavailable";
  }
  if (sessionAvPrimed) return "granted";
  if ((await queryMicGranted()) && (await queryCameraGranted())) {
    sessionAvPrimed = true;
    return "granted";
  }
  try {
    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const c of getVideoCallGetUserMediaAttempts()) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!stream) {
      const name = lastErr instanceof Error ? lastErr.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
      return "unavailable";
    }
    stopTracks(stream);
    sessionAvPrimed = true;
    return "granted";
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
    return "unavailable";
  }
}
