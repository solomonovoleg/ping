import { STORY_SOUND_PREF_KEY, STORY_VOLUME_KEY } from "./constants";

/** Только политика автовоспроизведения — не глушим звук при прочих сбоях `play()`. */
export function isMediaPlayNotAllowedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "NotAllowedError"
  );
}

export function getInitialStorySoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORY_SOUND_PREF_KEY) === "1";
}

export function getStoryVideoVolume(): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(STORY_VOLUME_KEY);
  const n = raw != null ? Number.parseFloat(raw) : 1;
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0.08, n));
}

export function setStoryVideoVolume(vol: number): void {
  if (typeof window === "undefined") return;
  const v = Math.min(1, Math.max(0, vol));
  window.localStorage.setItem(STORY_VOLUME_KEY, String(v));
}
