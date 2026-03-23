/**
 * Однострочное превью содержимого сообщения для списков (поиск, треки и т.д.).
 * Не показывать сырой JSON у story_reply / post_share.
 */
function truncateText(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function guessStructuredType(content: string): "story_reply" | "post_share" | null {
  const s = content.trim();
  if (!s.startsWith("{")) return null;
  try {
    const p = JSON.parse(s) as Record<string, unknown>;
    if (p && typeof p === "object" && "storyId" in p) return "story_reply";
    if (p && typeof p === "object" && ("postId" in p || "imageUrl" in p)) return "post_share";
  } catch {
    /* noop */
  }
  return null;
}

function effectiveMessageType(type: string | undefined | null, content: string): string {
  const t = (type ?? "").trim();
  if (t === "story_reply" || t === "post_share") return t;
  if (t === "text" || t === "" || t === "system") {
    const g = guessStructuredType(content);
    if (g) return g;
  }
  return t || "text";
}

export function formatMessageContentPreview(
  type: string | undefined | null,
  content: string,
  maxLen = 120,
): string {
  const c = content ?? "";
  const kind = effectiveMessageType(type, c);

  switch (kind) {
    case "text":
      return truncateText(c, maxLen);
    case "system":
      return truncateText(c, maxLen);
    case "voice":
      return "Голосовое сообщение";
    case "image":
      return "Фото";
    case "video":
    case "video_note":
      return "Видео";
    case "missed_call":
      return "Пропущенный звонок";
    case "post_share": {
      try {
        const p = JSON.parse(c) as { text?: string; authorName?: string };
        const snippet = (p.text || "Пост").trim();
        const author = (p.authorName || "").trim();
        const line = author ? `${snippet} · ${author}` : snippet;
        return truncateText(line, maxLen);
      } catch {
        return "Пост";
      }
    }
    case "story_reply": {
      try {
        const p = JSON.parse(c) as { replyText?: string; authorName?: string };
        const rt = (p.replyText || "").trim();
        if (rt) return truncateText(`Ответ на сториз: ${rt}`, maxLen);
        const an = (p.authorName || "").trim();
        return an ? truncateText(`Ответ на сториз · ${an}`, maxLen) : "Ответ на сториз";
      } catch {
        return truncateText(c, maxLen);
      }
    }
    default:
      return truncateText(c, maxLen);
  }
}
