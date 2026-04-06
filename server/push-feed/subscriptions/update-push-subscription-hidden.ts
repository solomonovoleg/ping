import { updatePushSubscriptionHidden } from "../db/push-subscriptions.queries";

export async function updateAuthorPushHidden(params: {
  subscriberId: string;
  authorId: string;
  hidden: boolean;
}): Promise<void> {
  await updatePushSubscriptionHidden(params.subscriberId, params.authorId, params.hidden);
}
