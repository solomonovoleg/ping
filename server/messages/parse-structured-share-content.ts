import { MessagesServiceError } from "./messages-service-error";

function cleanText(v: unknown, max = 300): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

function cleanUrl(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const ok = s.startsWith("/uploads/") || /^https?:\/\/[^/]+\//i.test(s);
  return ok ? s.slice(0, 2000) : undefined;
}

export function parseAndValidateStructuredShareContent(rawType: string, raw: string): string {
  if (rawType === "post_share") {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new MessagesServiceError(400, "Некорректный формат пересланного поста");
    }
    const postId = cleanText(parsed.postId, 80);
    if (!postId) throw new MessagesServiceError(400, "Для пересланного поста нужен postId");
    return JSON.stringify({
      postId,
      text: cleanText(parsed.text, 300) ?? "",
      imageUrl: cleanUrl(parsed.imageUrl) ?? null,
      authorName: cleanText(parsed.authorName, 120) ?? "",
      authorId: cleanText(parsed.authorId, 80) ?? "",
    });
  }
  if (rawType === "comment_share") {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new MessagesServiceError(400, "Некорректный формат пересланного комментария");
    }
    const postId = cleanText(parsed.postId, 80);
    const commentId = cleanText(parsed.commentId, 80);
    if (!postId || !commentId) {
      throw new MessagesServiceError(400, "Для пересланного комментария нужны postId и commentId");
    }
    return JSON.stringify({
      postId,
      commentId,
      text: cleanText(parsed.text, 500) ?? "",
      authorName: cleanText(parsed.authorName, 120) ?? "",
      authorId: cleanText(parsed.authorId, 80) ?? "",
      postPreview: cleanText(parsed.postPreview, 200) ?? "",
    });
  }
  if (rawType === "story_reply") {
    if (!raw.trim().startsWith("{")) return raw.trim();
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return JSON.stringify({
        storyId: cleanText(parsed.storyId, 80) ?? "",
        mediaUrl: cleanUrl(parsed.mediaUrl) ?? "",
        thumbnailUrl: cleanUrl(parsed.thumbnailUrl) ?? "",
        authorId: cleanText(parsed.authorId, 80) ?? "",
        authorName: cleanText(parsed.authorName, 120) ?? "",
        authorAvatar: cleanUrl(parsed.authorAvatar) ?? "",
        storyTimeLabel: cleanText(parsed.storyTimeLabel, 120) ?? "",
        replyText: cleanText(parsed.replyText, 500) ?? "",
      });
    } catch {
      throw new MessagesServiceError(400, "Некорректный формат ответа на сториз");
    }
  }
  return raw;
}
