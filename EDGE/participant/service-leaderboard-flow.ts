import type { LeaderboardPayload } from "./types.js";
import type { EdgeCampaignRow } from "../companion/repo.js";
import {
  countCampaignParticipants,
  getParticipantRankInCampaign,
  listCampaignLeaderboard,
} from "./repo.js";
import {
  buildLeaderboardEntries,
  buildLeaderboardPayload,
  normalizeLeaderboardLimit,
} from "./service-leaderboard.js";
import { getEdgePool } from "../db/pool.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { effectiveLeaderboardXpFrozen } from "./leaderboard-draw-freeze.js";

export function buildCampaignLeaderboardPayload(params: {
  edgeId: string;
  platformUserId: string;
  kind: "primary" | "secondary";
  campaign: EdgeCampaignRow;
  rows: Array<{ xp: number; level: number; care_streak_days: number; platform_user_id: string }>;
  totalParticipants: number;
  myRank: number | null;
  now: Date;
}): LeaderboardPayload {
  const frozen = effectiveLeaderboardXpFrozen(params.campaign, params.kind, params.now);
  const entries = buildLeaderboardEntries(params.rows, params.platformUserId);
  return buildLeaderboardPayload({
    edgeId: params.edgeId,
    kind: params.kind,
    frozen,
    entries,
    totalParticipants: params.totalParticipants,
    myRank: params.myRank,
  });
}

export async function getCampaignLeaderboardCore(
  edgeId: string,
  platformUserId: string,
  limitRaw: number,
  kind: "primary" | "secondary" = "primary",
): Promise<LeaderboardPayload | null> {
  if (!getEdgePool()) return null;
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return null;
  const limit = normalizeLeaderboardLimit(limitRaw);
  const total = await countCampaignParticipants(edgeId);
  if (total === null) return null;
  const rows = await listCampaignLeaderboard(edgeId, limit, kind);
  if (rows === null) return null;
  const myRank = await getParticipantRankInCampaign(edgeId, platformUserId, kind);
  return buildCampaignLeaderboardPayload({
    edgeId,
    platformUserId,
    kind,
    campaign,
    rows,
    totalParticipants: total,
    myRank,
    now: new Date(),
  });
}
