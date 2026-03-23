import { fetchUpstreamParticipantPath, getEdgeUpstreamBase } from "./upstream-client";

export type EdgeFollowRewardFollowDm = {
  text: string;
  mediaUrl: string | null;
} | null;

type FollowRewardUpstreamBody = {
  /** Сколько кампаний реально начислили награду за этот follow (0 = повторная подписка / нет права на награду). */
  awardedCount?: number;
  followDm?: EdgeFollowRewardFollowDm;
};

/** После подписки: XP в EDGE + опционально данные для авто-ЛС (`followDm`). */
export async function callEdgeFollowReward(params: {
  followerPlatformUserId: string;
  followedPlatformUserId: string;
}): Promise<FollowRewardUpstreamBody | null> {
  if (!getEdgeUpstreamBase()) return null;
  const up = await fetchUpstreamParticipantPath(`/v1/participant/follow-reward`, {
    method: "POST",
    platformUserId: params.followerPlatformUserId,
    body: JSON.stringify({ followedPlatformUserId: params.followedPlatformUserId.trim() }),
  });
  if (!up.ok || up.status < 200 || up.status >= 300) return null;
  try {
    return JSON.parse(up.body) as FollowRewardUpstreamBody;
  } catch {
    return null;
  }
}
