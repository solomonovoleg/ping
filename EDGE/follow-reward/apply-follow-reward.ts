import { listFollowRewardCampaignPublicIds } from "../companion/follow-reward-campaigns.js";
import { listPublishedMoneyCampaignIdsForCreator } from "../money/queries/list-published-money-campaign-ids-for-creator.js";
import { applyMoneyFollowCreatorReward } from "../money/platform-events/apply-money-follow-creator-reward.js";
import { applyTaskReward } from "../tasks/apply-task.js";
import type { TaskRewardResponse } from "../tasks/types.js";

export type FollowRewardSummary = {
  campaignsTried: number;
  awardedCount: number;
  /** `public_id` кампаний, где за этот вызов реально выдали XP (для привязки авто-ЛС). */
  awardedCampaignPublicIds: string[];
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
  if (edgeIds.length === 0) {
    return { campaignsTried: 0, awardedCount: 0, awardedCampaignPublicIds: [], lastState: null };
  }

  let awardedCount = 0;
  const awardedCampaignPublicIds: string[] = [];
  let lastState: TaskRewardResponse["state"] | null = null;

  for (const edgeId of edgeIds) {
    const out = await applyTaskReward(edgeId, followerPlatformUserId, "follow_creator", followed);
    if (!out) return null;
    lastState = out.state;
    if (out.awarded) {
      awardedCount += 1;
      awardedCampaignPublicIds.push(edgeId);
    }
  }

  const moneyEdgeIds = await listPublishedMoneyCampaignIdsForCreator(followed);
  for (const edgeId of moneyEdgeIds) {
    const m = await applyMoneyFollowCreatorReward({
      edgeId,
      followerPlatformUserId,
      followedCreatorPlatformUserId: followed,
    });
    if (m === null) return null;
    if (m.awarded) {
      awardedCount += 1;
      awardedCampaignPublicIds.push(edgeId);
    }
  }

  const campaignsTried = edgeIds.length + moneyEdgeIds.length;
  return { campaignsTried, awardedCount, awardedCampaignPublicIds, lastState };
}
