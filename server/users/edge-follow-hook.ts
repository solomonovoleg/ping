import { callEdgeFollowReward } from "../edge/call-follow-reward";
import { sendEdgeFollowRewardDm } from "./edge-follow-dm-sender";

/** Фоновый вызов EDGE после успешной подписки; сбой EDGE не влияет на follow. */
export function scheduleEdgeFollowReward(followerUserId: string, followedUserId: string): void {
  void (async () => {
    try {
      const body = await callEdgeFollowReward({
        followerPlatformUserId: followerUserId,
        followedPlatformUserId: followedUserId,
      });
      const awarded = typeof body?.awardedCount === "number" ? body.awardedCount : 0;
      const dm = body?.followDm;
      if (
        awarded > 0 &&
        dm &&
        (dm.text?.trim() || dm.mediaUrl?.trim())
      ) {
        await sendEdgeFollowRewardDm({
          creatorUserId: followedUserId,
          followerUserId: followerUserId,
          text: typeof dm.text === "string" ? dm.text : "",
          mediaUrl: typeof dm.mediaUrl === "string" && dm.mediaUrl.trim() ? dm.mediaUrl.trim() : null,
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[users/edge-follow-hook]", e);
      }
    }
  })();
}
