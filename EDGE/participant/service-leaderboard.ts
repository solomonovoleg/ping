import type { LeaderboardEntryPayload, LeaderboardPayload } from "./types.js";

type LeaderboardRowShape = {
  xp: number;
  level: number;
  care_streak_days: number;
  platform_user_id: string;
};

export function normalizeLeaderboardLimit(limitRaw: number): number {
  return Math.min(100, Math.max(5, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 30));
}

export function buildLeaderboardEntries(
  rows: LeaderboardRowShape[],
  platformUserId: string,
): LeaderboardEntryPayload[] {
  return rows.map((r, i) => ({
    rank: i + 1,
    xp: r.xp,
    level: r.level,
    careStreakDays: r.care_streak_days,
    isMe: r.platform_user_id === platformUserId,
    platformUserId: r.platform_user_id,
  }));
}

export function buildLeaderboardPayload(params: {
  edgeId: string;
  kind: "primary" | "secondary";
  frozen: boolean;
  totalParticipants: number;
  myRank: number | null;
  entries: LeaderboardEntryPayload[];
}): LeaderboardPayload {
  return {
    edgeId: params.edgeId,
    kind: params.kind,
    frozen: params.frozen,
    entries: params.entries,
    totalParticipants: params.totalParticipants,
    myRank: params.myRank,
  };
}
