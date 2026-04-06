import type { Request, Response, NextFunction } from "express";
import { applyFollowCreatorRewards } from "./apply-follow-reward.js";
import { pickFollowDmPayloadForAwardedCampaigns } from "./follow-dm-config.js";

export async function postFollowReward(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const followerId = req.edgePlatformUserId ?? "";
    const body = (req.body ?? {}) as { followedPlatformUserId?: unknown };
    const followed =
      typeof body.followedPlatformUserId === "string" ? body.followedPlatformUserId.trim() : "";
    if (!followed) {
      res.status(400).json({ error: "followed_platform_user_id_required" });
      return;
    }
    if (followed === followerId) {
      res.status(400).json({ error: "cannot_follow_reward_self" });
      return;
    }

    const out = await applyFollowCreatorRewards(followerId, followed);
    if (out === null) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }

    const followDm =
      out.awardedCount > 0 && out.awardedCampaignPublicIds.length > 0
        ? await pickFollowDmPayloadForAwardedCampaigns(followed, out.awardedCampaignPublicIds)
        : null;

    res.json({
      campaignsTried: out.campaignsTried,
      awardedCount: out.awardedCount,
      state: out.lastState,
      followDm,
    });
  } catch (e) {
    next(e);
  }
}
