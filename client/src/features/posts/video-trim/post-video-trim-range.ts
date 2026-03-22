import { POST_VIDEO_MAX_SECONDS, POST_VIDEO_MIN_SEGMENT_SECONDS } from "@shared/post-video";

export function formatPostVideoTrimTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Сжимает [start,end] в допустимые границы по длительности ролика и лимиту сегмента (пост / аватар). */
export function normalizePostVideoTrimRange(
  startSec: number,
  endSec: number,
  durationSec: number,
  maxSegmentSec: number = POST_VIDEO_MAX_SECONDS,
): [number, number] {
  const MIN = POST_VIDEO_MIN_SEGMENT_SECONDS;
  const MAX = maxSegmentSec;
  let s = startSec;
  let e = endSec;
  s = Math.max(0, s);
  e = Math.min(durationSec, e);
  if (e < s + MIN) e = Math.min(durationSec, s + MIN);
  if (e - s > MAX) e = s + MAX;
  if (e > durationSec) {
    e = durationSec;
    s = Math.max(0, e - MAX);
    if (e - s < MIN) s = Math.max(0, e - MIN);
  }
  if (s < 0) s = 0;
  if (e - s < MIN) e = Math.min(durationSec, s + MIN);
  return [s, e];
}
