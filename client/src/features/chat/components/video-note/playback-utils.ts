export type VideoNotePlaybackRate = 1 | 1.5 | 2;

const PLAYBACK_RATES: VideoNotePlaybackRate[] = [1, 1.5, 2];

export function nextVideoNotePlaybackRate(current: VideoNotePlaybackRate): VideoNotePlaybackRate {
  const idx = PLAYBACK_RATES.indexOf(current);
  if (idx < 0) return 1;
  return PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
}

export function formatVideoNoteDuration(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
