import type { EdgeCampaignRow } from "../companion/repo.js";
import { effectiveLeaderboardXpFrozen } from "./leaderboard-draw-freeze.js";
import { ensureCharacterRow, incrementCharacterTaskXp, type CharacterRow } from "./repo.js";

export function shouldKeepTaskXpUnchanged(
  campaign: EdgeCampaignRow,
  xpDelta: number,
  now: Date,
  target: "primary" | "secondary",
): boolean {
  return xpDelta !== 0 && effectiveLeaderboardXpFrozen(campaign, target, now);
}

export async function applyTaskXpToParticipantCore(
  campaign: EdgeCampaignRow,
  participantId: string,
  xpDelta: number,
  now: Date,
  target: "primary" | "secondary" = "primary",
): Promise<CharacterRow | null> {
  if (shouldKeepTaskXpUnchanged(campaign, xpDelta, now, target)) {
    return ensureCharacterRow(participantId);
  }
  return incrementCharacterTaskXp(participantId, xpDelta, now, target);
}
