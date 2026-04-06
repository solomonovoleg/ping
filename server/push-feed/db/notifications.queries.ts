import { notifications } from "@shared/schema";
import { getDb } from "../../db";

export async function insertPushNotificationsBatch(params: {
  subscriberIds: string[];
  authorId: string;
  postId: string;
  excerpt: string;
}): Promise<void> {
  if (!params.subscriberIds.length) return;
  const db = getDb();
  await db.insert(notifications).values(
    params.subscriberIds.map((userId) => ({
      userId,
      type: "push_post",
      actorId: params.authorId,
      postId: params.postId,
      excerpt: params.excerpt.slice(0, 200),
    })),
  );
}
