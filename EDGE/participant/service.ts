import type { LeaderboardPayload, ParticipantStatePayload } from "./types.js";
import type { CharacterRow, ParticipantRow } from "./repo.js";
import type { InteractKind } from "./character-rules.js";
import { getCampaignLeaderboardCore } from "./service-leaderboard-flow.js";
import { postParticipantFeedCore } from "./service-feed-flow.js";
import { postParticipantInteractCore } from "./service-interact-flow.js";
import type { PostInteractOutcome } from "./service-interact-cooldown.js";
import { applyTaskXpToParticipantCore } from "./service-task-xp.js";
import { getParticipantStateCore } from "./service-state.js";
import type { EdgeCampaignRow } from "../companion/repo.js";

export type { ParticipantRow } from "./repo.js";
export type { PostInteractOutcome } from "./service-interact-cooldown.js";

export async function getParticipantState(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | null> {
  return getParticipantStateCore(edgeId, platformUserId);
}

export async function postParticipantFeed(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | "locked" | null> {
  return postParticipantFeedCore(edgeId, platformUserId);
}

export async function getCampaignLeaderboard(
  edgeId: string,
  platformUserId: string,
  limitRaw: number,
  kind: "primary" | "secondary" = "primary",
): Promise<LeaderboardPayload | null> {
  return getCampaignLeaderboardCore(edgeId, platformUserId, limitRaw, kind);
}

export async function postParticipantInteract(
  edgeId: string,
  platformUserId: string,
  kind: InteractKind,
): Promise<PostInteractOutcome | "locked" | null> {
  return postParticipantInteractCore(edgeId, platformUserId, kind);
}

/** Для задач: начислить XP после записи в edge_task_grants. */
export async function applyTaskXpToParticipant(
  campaign: EdgeCampaignRow,
  participantId: string,
  xpDelta: number,
  now: Date,
  target: "primary" | "secondary" = "primary",
): Promise<CharacterRow | null> {
  return applyTaskXpToParticipantCore(campaign, participantId, xpDelta, now, target);
}
