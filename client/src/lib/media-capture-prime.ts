/**
 * Единый способ «попросить» доступ к микрофону/камере и сразу отпустить устройство.
 * Браузер запоминает разрешение для origin; важно вызывать getUserMedia с одними и теми же
 * смысловыми constraints (как при звонках), иначе часть движков ведёт себя как новый запрос.
 */
import { getMediaConstraints } from "@/features/call/call-ice-config";

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
  try {
    const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(false));
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
    const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(true));
    stopTracks(stream);
    sessionAvPrimed = true;
    return "granted";
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
    return "unavailable";
  }
}
