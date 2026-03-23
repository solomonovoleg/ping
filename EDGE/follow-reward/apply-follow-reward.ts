import { listFollowRewardCampaignPublicIds } from "../companion/follow-reward-campaigns.js";
import { applyTaskReward } from "../tasks/apply-task.js";
import type { TaskRewardResponse } from "../tasks/types.js";

export type FollowRewardSummary = {
  campaignsTried: number;
  awardedCount: number;
  lastState: TaskRewardResponse["state"] | null;
};

/**
 * Начисляет XP за подписку на создателя по всем его кампаниям с `follow_reward_enabled`.
 * Идемпотентность — через `edge_task_grants` (task_key `follow_creator`, ref = id автора).
 */
export async function applyFollowCreatorRewards(
  followerPlatformUserId: string,
  followedPlatformUserId: string,
): Promise<FollowRewardSummary | null> {
  const followed = followedPlatformUserId.trim();
  if (!followed || followed === followerPlatformUserId.trim()) return null;

  const edgeIds = await listFollowRewardCampaignPublicIds(followed);
  if (edgeIds.length === 0) return { campaignsTried: 0, awardedCount: 0, lastState: null };

  let awardedCount = 0;
  let lastState: TaskRewardResponse["state"] | null = null;

  for (const edgeId of edgeIds) {
    const out = await applyTaskReward(edgeId, followerPlatformUserId, "follow_creator", followed);
    if (!out) return null;
    lastState = out.state;
    if (out.awarded) awardedCount += 1;
  }

  return { campaignsTried: edgeIds.length, awardedCount, lastState };
}
