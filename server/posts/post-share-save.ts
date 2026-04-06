import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { notifyChatListUpdate } from "../calls/ws";
import { notifyNewMessage } from "../realtime/chat";
import { buildChatMessageNotifyPayload } from "../messages/build-chat-message-notify-payload";
import { enrichChatMessagePayloadOwnS3Urls } from "../messages/enrich-message-media-s3-urls";
import { shouldSkipChatDmPushForRecipient } from "../chats/chat-message-push-folder-mute";
import { sendPushToUser } from "../push/send";
import { buildDmPushPayload } from "../push/chat-message-push";
import { storage } from "../storage";
import { postShares, posts, savedPosts } from "@shared/schema";
import { PostsServiceError } from "./posts-service-error";
import { resolveCanonicalPostId } from "./resolve-post-ref";

export async function sharePostToUser(
  postRef: string,
  fromUserId: string,
  toUserId: string,
): Promise<{ chatId: string }> {
  if (toUserId === fromUserId) {
    throw new PostsServiceError(400, "Нельзя отправить пост себе");
  }
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  const [postRow] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!postRow) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const toUser = await storage.getUser(toUserId);
  if (!toUser || toUser.deletedAt || toUser.isBlocked) {
    throw new PostsServiceError(404, "Пользователь не найден");
  }
  const chat = await storage.getOrCreateDmChat(fromUserId, toUserId);
  const author = await storage.getUser(postRow.authorId);
  const authorName = author
    ? [author.displayName, author.surname].filter(Boolean).join(" ") || `ID ${author.publicId}`
    : "Пользователь";
  await db.insert(postShares).values({
    postId,
    fromUserId,
    toUserId,
  });
  const previewContent = JSON.stringify({
    postId,
    text: postRow.text?.slice(0, 200) ?? "",
    imageUrl: postRow.imageUrl ?? null,
    authorName,
    authorId: postRow.authorId,
  });
  const message = await storage.createMessage({
    chatId: chat.id,
    senderId: fromUserId,
    type: "post_share",
    content: previewContent,
  });
  const payload = await enrichChatMessagePayloadOwnS3Urls(buildChatMessageNotifyPayload(message));
  notifyNewMessage(chat.id, payload);
  const memberIds = await storage.getChatMemberIds(chat.id);
  for (const memberId of memberIds) {
    notifyChatListUpdate(memberId, { incomingMessage: { chatId: chat.id, senderId: fromUserId } });
  }
  const sender = await storage.getUser(fromUserId);
  const senderName =
    [sender?.displayName, sender?.surname].filter(Boolean).join(" ") || "Новое сообщение";
  const push = buildDmPushPayload("post_share", previewContent, senderName);
  for (const memberId of memberIds) {
    if (memberId === fromUserId) continue;
    void shouldSkipChatDmPushForRecipient(memberId, chat.id).then((skip) => {
      if (skip) return;
      return sendPushToUser(
        memberId,
        push.title,
        push.body,
        { chatId: chat.id, ...push.dataFields },
        { androidChannelId: push.androidChannelId, iosSound: push.iosSound },
      ).then((r) => {
        if (!r.ok) {
          console.warn("[push] post_share: не отправлено", { recipientId: memberId, chatId: chat.id, reason: r.reason });
        }
      });
    });
  }
  const { scheduleEdgeTaskAfterPostAction } = await import("./edge-task-hook");
  scheduleEdgeTaskAfterPostAction(fromUserId, postId, "share_post");
  return { chatId: chat.id };
}

export async function savePost(userId: string, postRef: string): Promise<void> {
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  await db.insert(savedPosts).values({ userId, postId }).onConflictDoNothing();
}

export async function unsavePost(userId: string, postRef: string): Promise<void> {
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  await db.delete(savedPosts).where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
}
