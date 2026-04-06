import { deletePushSubscription } from "../db/push-subscriptions.queries";

export async function unsubscribeFromAuthorPush(params: {
  subscriberId: string;
  authorId: string;
}): Promise<void> {
  await deletePushSubscription(params.subscriberId, params.authorId);
}
