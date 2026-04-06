import type { ParticipantStatePayload } from "../participant/types.js";

export const TASK_KEYS = ["view_post", "react_post", "share_post", "follow_creator"] as const;
export type TaskKey = (typeof TASK_KEYS)[number];

export type TaskDenyReason =
  | "already_claimed"
  | "campaign_locked"
  | "not_published"
  | "deadline_passed"
  | "invalid_preset"
  | "verification_failed"
  | "leaderboard_frozen"
  | "honor_disabled";

export type TaskRewardResponse = {
  awarded: boolean;
  xpDelta: number;
  /** Встроенный или пресетный ключ (до 64 символов в БД). */
  taskKey: string;
  state: ParticipantStatePayload;
  denyReason?: TaskDenyReason;
};
