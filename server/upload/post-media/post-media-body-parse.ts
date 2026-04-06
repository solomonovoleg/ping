import { AVATAR_VIDEO_MAX_SECONDS, POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import type { VideoTranscodeProfile, VideoTranscodeTrim } from "../story-video-transcode";

export function parseTrimCapSec(body: Record<string, unknown> | undefined): number {
  if (!body) return POST_VIDEO_MAX_SECONDS;
  const raw = body.trimMaxSeconds;
  const n = Number.parseInt(String(raw ?? ""), 10);
  if (n === AVATAR_VIDEO_MAX_SECONDS) return AVATAR_VIDEO_MAX_SECONDS;
  return POST_VIDEO_MAX_SECONDS;
}

export function parsePostVideoTrim(body: Record<string, unknown> | undefined): VideoTranscodeTrim | undefined {
  if (!body) return undefined;
  const cap = parseTrimCapSec(body);
  const s = body.trimStartSec;
  const d = body.trimDurationSec;
  const hasS = s !== undefined && s !== null && String(s).trim() !== "";
  const hasD = d !== undefined && d !== null && String(d).trim() !== "";
  if (!hasS || !hasD) return undefined;
  const startSec = Math.max(0, Number.parseFloat(String(s)) || 0);
  let durationSec = Number.parseFloat(String(d));
  if (!Number.isFinite(durationSec)) durationSec = cap;
  durationSec = Math.min(cap, Math.max(0.1, durationSec));
  return { startSec, durationSec, maxSegmentSec: cap };
}

export function getVideoTranscodeProfile(trim: VideoTranscodeTrim | undefined): VideoTranscodeProfile {
  return trim?.maxSegmentSec === AVATAR_VIDEO_MAX_SECONDS ? "avatar" : "default";
}
