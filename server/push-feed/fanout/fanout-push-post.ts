import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { getDb } from "../../db";
import { sendPushToUser } from "../../push/send";
import { fetchPushNotificationRecipientIdsByAuthor, fetchPushSubscriberIdsByAuthor } from "../db/push-subscriptions.queries";
import { insertPushNotificationsBatch } from "../db/notifications.queries";
import { buildAuthorPostDeepLink } from "../utils/author-deeplink";
import { logPushFanout } from "../telemetry/log-push-feed";

export async function fanoutPushPost(params: {
  postId: string;
  postLinkCode: string | null;
  authorId: string;
  excerpt: string;
}): Promise<void> {
  const subscriberIds = (await fetchPushSubscriberIdsByAuthor(params.authorId)).filter((id) => id !== params.authorId);
  if (!subscriberIds.length) return;
  const pushRecipientIds = (await fetchPushNotificationRecipientIdsByAuthor(params.authorId)).filter(
    (id) => id !== params.authorId,
  );

  const db = getDb();
  const [author] = await db
    .select({
      publicId: users.publicId,
      name: users.displayName,
      surname: users.surname,
    })
    .from(users)
    .where(eq(users.id, params.authorId))
    .limit(1);

  const actorName = [author?.name, author?.surname].filter(Boolean).join(" ").trim() || "Пользователь";
  const deeplink = buildAuthorPostDeepLink({
    authorPublicId: author?.publicId ?? null,
    authorId: params.authorId,
    postLinkCode: params.postLinkCode,
    postId: params.postId,
  });

  await insertPushNotificationsBatch({
    subscriberIds,
    authorId: params.authorId,
    postId: params.postId,
    excerpt: params.excerpt,
  });

  const pushTitle = `${actorName}: Push`;
  const pushBody = params.excerpt.trim() || "Новый микропост в Push-ленте";
  await Promise.allSettled(
    pushRecipientIds.map((subscriberId) =>
      sendPushToUser(
        subscriberId,
        pushTitle,
        pushBody,
        {
          ping_push_kind: "push_post",
          ping_post_id: params.postId,
          ping_deeplink: deeplink,
        },
        { androidChannelId: "ping_dm" },
      ),
    ),
  );

  logPushFanout({ postId: params.postId, authorId: params.authorId, subscribers: pushRecipientIds.length });
}
