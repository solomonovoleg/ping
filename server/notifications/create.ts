import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, posts, users } from "@shared/schema";
import { buildAuthorPostDeepLink } from "../push-feed/utils/author-deeplink";
import { sendPushToUser } from "../push/send";

/** Мобильные пуши модуля Push (и входящие микропосты, и события вокруг своей Push-ленты) — см. настройку «Пуш модуля Push». */
async function authorWantsPushModuleDeviceNotifications(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ enabled: users.pushFeedNotificationsEnabled })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.enabled !== false;
}

/** Уведомление автору поста о новом комментарии (если комментатор не автор поста). */
export async function notifyComment(
  postId: string,
  commentId: string,
  actorId: string,
  excerpt: string,
  opts?: { parentCommentAuthorId: string | null }
): Promise<void> {
  const db = getDb();
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.authorId === actorId) return;
  const parentAuthor = opts?.parentCommentAuthorId ?? null;
  /** Ответ автору поста на его же комментарий — одно уведомление через notifyCommentReply, без дубля «комментарий к посту». */
  if (parentAuthor && parentAuthor === post.authorId) return;
  try {
    await db.insert(notifications).values({
      userId: post.authorId,
      type: "comment",
      actorId,
      postId,
      commentId,
      excerpt: excerpt.slice(0, 200),
    });
  } catch (e) {
    console.error("[notifications] comment:", e);
  }
}

/** Уведомление автору комментария, на который ответили (если отвечающий не он сам). */
export async function notifyCommentReply(
  postId: string,
  commentId: string,
  actorId: string,
  parentCommentAuthorId: string,
  excerpt: string
): Promise<void> {
  if (parentCommentAuthorId === actorId) return;
  const db = getDb();
  try {
    await db.insert(notifications).values({
      userId: parentCommentAuthorId,
      type: "comment_reply",
      actorId,
      postId,
      commentId,
      excerpt: excerpt.slice(0, 200),
    });
  } catch (e) {
    console.error("[notifications] comment_reply:", e);
  }
}

/** Уведомление автору поста о реакции (лайк и т.д.), если поставивший не автор. */
export async function notifyReaction(postId: string, actorId: string, emoji: string): Promise<void> {
  const db = getDb();
  const [post] = await db.select({ authorId: posts.authorId }).from(posts).where(eq(posts.id, postId)).limit(1);
  if (!post || post.authorId === actorId) return;
  try {
    await db.insert(notifications).values({
      userId: post.authorId,
      type: "reaction",
      actorId,
      postId,
      excerpt: emoji,
    });
  } catch (e) {
    console.error("[notifications] reaction:", e);
  }
}

/** Уведомление автору Push о публичном/личном ответе на карточку (в ленте + FCM при наличии токена). */
export async function notifyPushReply(params: {
  pushAuthorId: string;
  actorId: string;
  postId: string;
  excerpt: string;
}): Promise<void> {
  if (params.pushAuthorId === params.actorId) return;
  const db = getDb();
  try {
    await db.insert(notifications).values({
      userId: params.pushAuthorId,
      type: "push_reply",
      actorId: params.actorId,
      postId: params.postId,
      excerpt: params.excerpt.slice(0, 200),
    });
  } catch (e) {
    console.error("[notifications] push_reply:", e);
    return;
  }

  try {
    if (!(await authorWantsPushModuleDeviceNotifications(params.pushAuthorId))) return;
    const [actorRow] = await db
      .select({ displayName: users.displayName, surname: users.surname })
      .from(users)
      .where(eq(users.id, params.actorId))
      .limit(1);
    const [postRow] = await db
      .select({ linkCode: posts.linkCode, authorId: posts.authorId })
      .from(posts)
      .where(eq(posts.id, params.postId))
      .limit(1);
    const postAuthorId = postRow?.authorId ?? params.pushAuthorId;
    const [authorUser] = await db
      .select({ publicId: users.publicId })
      .from(users)
      .where(eq(users.id, postAuthorId))
      .limit(1);
    const actorName = [actorRow?.displayName, actorRow?.surname].filter(Boolean).join(" ").trim() || "Пользователь";
    const deeplink = buildAuthorPostDeepLink({
      authorPublicId: authorUser?.publicId ?? null,
      authorId: postAuthorId,
      postLinkCode: postRow?.linkCode ?? null,
      postId: params.postId,
    });
    const body = params.excerpt.trim().slice(0, 160) || "Новый ответ на ваш Push";
    void sendPushToUser(
      params.pushAuthorId,
      `${actorName} ответил(а) на ваш Push`,
      body,
      {
        ping_push_kind: "push_reply",
        ping_post_id: params.postId,
        ping_deeplink: deeplink,
      },
      { androidChannelId: "ping_dm" },
    ).catch((e) => {
      console.error("[notifications] push_reply FCM:", e);
    });
  } catch (e) {
    console.error("[notifications] push_reply FCM prep:", e);
  }
}

/** Уведомление пользователю о новой подписке на него. */
export async function notifyFollow(targetUserId: string, actorId: string): Promise<void> {
  if (targetUserId === actorId) return;
  const db = getDb();
  try {
    await db.insert(notifications).values({
      userId: targetUserId,
      type: "follow",
      actorId,
    });
  } catch (e) {
    console.error("[notifications] follow:", e);
  }
}

/** Автору Push-ленты: кто-то впервые подписался на его микропосты (запись в ленте уведомлений + FCM). */
export async function notifyPushFeedSubscribe(authorId: string, subscriberId: string): Promise<void> {
  if (!authorId || !subscriberId || authorId === subscriberId) return;
  const db = getDb();
  try {
    await db.insert(notifications).values({
      userId: authorId,
      type: "push_subscribe",
      actorId: subscriberId,
    });
  } catch (e) {
    console.error("[notifications] push_subscribe:", e);
    return;
  }

  try {
    if (!(await authorWantsPushModuleDeviceNotifications(authorId))) return;
    const [actorRow] = await db
      .select({ displayName: users.displayName, surname: users.surname, publicId: users.publicId })
      .from(users)
      .where(eq(users.id, subscriberId))
      .limit(1);
    const actorName = [actorRow?.displayName, actorRow?.surname].filter(Boolean).join(" ").trim() || "Подписчик";
    const profileSeg =
      actorRow?.publicId != null ? String(actorRow.publicId) : encodeURIComponent(subscriberId);
    const deeplink = `/u/${profileSeg}`;
    void sendPushToUser(
      authorId,
      "Новый подписчик на Push",
      `${actorName} подписался(ась) на ваши Push`,
      {
        ping_push_kind: "push_subscribe",
        ping_deeplink: deeplink,
        ping_actor_id: subscriberId,
      },
      { androidChannelId: "ping_dm" },
    ).catch((e) => {
      console.error("[notifications] push_subscribe FCM:", e);
    });
  } catch (e) {
    console.error("[notifications] push_subscribe FCM prep:", e);
  }
}

type BusinessStatusResult = "approved" | "rejected" | "revision_required";

export async function notifyBusinessStatusResult(
  targetUserId: string,
  adminActorId: string,
  result: BusinessStatusResult,
  adminComment?: string | null,
): Promise<void> {
  if (!targetUserId || !adminActorId || targetUserId === adminActorId) return;
  const db = getDb();
  const excerpt = (adminComment ?? "").trim().slice(0, 200) || null;
  const type =
    result === "approved"
      ? "business_status_approved"
      : result === "rejected"
        ? "business_status_rejected"
        : "business_status_revision";
  try {
    await db.insert(notifications).values({
      userId: targetUserId,
      type,
      actorId: adminActorId,
      excerpt,
    });
  } catch (e) {
    console.error("[notifications] business_status:", e);
  }

  const pushBodyBase =
    result === "approved"
      ? "Ваша заявка на бизнес-статус одобрена."
      : result === "rejected"
        ? "Ваша заявка на бизнес-статус отклонена."
        : "Ваша заявка отправлена на доработку.";
  const pushBody = excerpt ? `${pushBodyBase} ${excerpt}` : pushBodyBase;

  void sendPushToUser(
    targetUserId,
    "Статус бизнес-заявки",
    pushBody,
    {
      ping_push_kind: "business_status_result",
      ping_business_status_result: result,
      ping_deeplink: "/profile/edit?focus=business-status",
    },
    { androidChannelId: "ping_dm" },
  ).catch((e) => {
    console.error("[notifications] business_status push:", e);
  });
}
