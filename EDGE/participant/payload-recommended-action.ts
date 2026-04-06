import type { ActiveNeed, ActionProgress } from "./character-rules.js";
import type { ParticipantStatePayload } from "./types.js";

type LifeRecommended = "feed" | "toilet" | "play" | "calm" | null;

export function normalizeLifeRecommended(lifePick: unknown): LifeRecommended {
  return lifePick === "feed" || lifePick === "toilet" || lifePick === "play" || lifePick === "calm"
    ? lifePick
    : null;
}

export function pickRecommendedAction(params: {
  actionProgress: ActionProgress;
  lifeRecommended: LifeRecommended;
  activeNeed: ActiveNeed;
}): ParticipantStatePayload["recommendedAction"] {
  if (params.actionProgress.feed > 0) return "feed";
  if (params.actionProgress.toilet > 0) return "toilet";
  if (params.actionProgress.play > 0) return "play";
  if (params.lifeRecommended) return params.lifeRecommended;
  if (params.activeNeed === "hungry") return "feed";
  if (params.activeNeed === "dirty") return "toilet";
  if (params.activeNeed === "bored") return "play";
  if (params.activeNeed === "anxious") return "calm";
  return null;
}
