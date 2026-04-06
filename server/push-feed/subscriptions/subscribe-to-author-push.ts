import { notifyPushFeedSubscribe } from "../../notifications/create";
import { PostsServiceError } from "../../posts/posts-service-error";
import { hasPushSubscription, insertPushSubscription } from "../db/push-subscriptions.queries";

export async function subscribeToAuthorPush(params: { subscriberId: string; authorId: string }): Promise<void> {
  if (params.subscriberId === params.authorId) {
    throw new PostsServiceError(400, "Нельзя подписаться на Push самого себя");
  }
  const alreadyHadRow = await hasPushSubscription(params.subscriberId, params.authorId);
  await insertPushSubscription(params.subscriberId, params.authorId);
  if (!alreadyHadRow) {
    void notifyPushFeedSubscribe(params.authorId, params.subscriberId).catch((e) => {
      console.error("[push-feed] notify push_subscribe:", e);
    });
  }
}
