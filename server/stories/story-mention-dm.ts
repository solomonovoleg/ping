import { and, eq } from "drizzle-orm";
import { extractMentions, MAX_POST_MENTIONS } from "@shared/schema/posts";
import { getDb } from "../db";
import { resolveMentionToUserId } from "../notifications/mentions";
import { storage } from "../storage";
import { stories, users } from "@shared/schema";

function storyTimeLabelRu(createdAt: Date | null | undefined): string {
  if (!createdAt || !Number.isFinite(createdAt.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(createdAt);
  } catch {
    return "";
  }
}

/**
 * Отметки в подписи к сторис — только в личку (как ответ на сториз), не в раздел «Уведомления».
 */
export async function sendStoryMentionDirectMessages(
  storyId: string,
  authorId: string,
  caption: string,
): Promise<void> {
  const mentions = extractMentions(caption);
  if (mentions.length === 0) return;

  const db = getDb();
  const [story] = await db
    .select({
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      createdAt: stories.createdAt,
    })
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.authorId, authorId)))
    .limit(1);
  if (!story?.mediaUrl?.trim()) return;

  const [author] = await db
    .select({
      displayName: users.displayName,
      surname: users.surname,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);

  const authorName = [author?.displayName, author?.surname].filter(Boolean).join(" ").trim() || "Пользователь";
  const authorAvatar = author?.avatarUrl?.trim() ?? "";
  const storyTimeLabel = storyTimeLabelRu(story.createdAt ?? null);
  const mediaUrl = story.mediaUrl.trim();
  const thumb = story.thumbnailUrl?.trim();

  const { sendChatMessage } = await import("../messages/service");

  const seen = new Set<string>();
  for (const m of mentions) {
    if (seen.size >= MAX_POST_MENTIONS) break;
    const targetId = await resolveMentionToUserId(m, storage, authorId);
    if (!targetId || seen.has(targetId)) continue;
    seen.add(targetId);

    const cap = caption.trim();
    const replyText =
      cap.length > 0
        ? `Вас отметили в истории.\n\n${cap.slice(0, 480)}${cap.length > 480 ? "…" : ""}`
        : "Вас отметили в истории.";

    try {
      const chat = await storage.getOrCreateDmChat(authorId, targetId);
      const payload = JSON.stringify({
        storyId,
        mediaUrl,
        ...(thumb ? { thumbnailUrl: thumb } : {}),
        authorId,
        authorName,
        authorAvatar,
        storyTimeLabel,
        replyText,
      });
      await sendChatMessage({
        userId: authorId,
        chatId: chat.id,
        type: "story_reply",
        content: payload,
      });
    } catch (e) {
      console.error("[stories] mention DM:", e);
    }
  }
}
