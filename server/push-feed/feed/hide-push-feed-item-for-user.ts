import { hidePushFeedItem } from "../db/push-posts.queries";

export async function hidePushFeedItemForUser(params: { userId: string; pushPostId: string }): Promise<void> {
  await hidePushFeedItem(params.userId, params.pushPostId);
}
