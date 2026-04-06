/**
 * Однострочное превью содержимого сообщения для списков (поиск, треки и т.д.).
 * Не показывать сырой JSON у story_reply / post_share и секреты в тексте.
 */
import { redactChatPreviewIfSensitive } from "@shared/sensitive-message-preview";
import { getChatTableListPreviewLine } from "../message-table";
function truncateText(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, Math.max(0, maxLen - 1)) + "…";
}

function guessStructuredType(content: string): "story_reply" | "post_share" | "comment_share" | null {
  const s = content.trim();
  if (!s.startsWith("{")) return null;
  try {
    const p = JSON.parse(s) as Record<string, unknown>;
    if (p && typeof p === "object" && "storyId" in p) return "story_reply";
    if (p && typeof p === "object" && "commentId" in p && "postId" in p) return "comment_share";
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
    case "text": {
      const tableLine = getChatTableListPreviewLine(c);
      if (tableLine) return truncateText(tableLine, maxLen);
      return truncateText(redactChatPreviewIfSensitive(c), maxLen);
    }
    case "system":
      return truncateText(redactChatPreviewIfSensitive(c), maxLen);
    case "voice":
      return "Голосовое сообщение";
    case "image":
      return "Фото";
    case "sticker":
      return "Стикер";
    case "video":
    case "video_note":
      return "Видео";
    case "file": {
      try {
        const p = JSON.parse(c) as { mime?: string; name?: string };
        const m = typeof p.mime === "string" ? p.mime.toLowerCase() : "";
        const n = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "";
        if (m === "text/csv" || m === "application/csv" || n.toLowerCase().endsWith(".csv")) {
          const label = n || "таблица.csv";
          return truncateText(`CSV: ${label}`, maxLen);
        }
        if (
          m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          n.toLowerCase().endsWith(".xlsx")
        ) {
          const label = n || "таблица.xlsx";
          return truncateText(`Excel: ${label}`, maxLen);
        }
      } catch {
        /* fall through */
      }
      return "PDF-документ";
    }
    case "missed_call":
      return "Пропущенный звонок";
    case "post_share": {
      try {
        const p = JSON.parse(c) as { text?: string; authorName?: string };
        const snippet = (p.text || "Пост").trim();
        const author = (p.authorName || "").trim();
        const line = author ? `${snippet} · ${author}` : snippet;
        return truncateText(redactChatPreviewIfSensitive(line), maxLen);
      } catch {
        return "Пост";
      }
    }
    case "comment_share": {
      try {
        const p = JSON.parse(c) as { text?: string; authorName?: string };
        const snippet = (p.text || "").trim();
        const author = (p.authorName || "").trim();
        if (!snippet) return author ? `Комментарий · ${author}` : "Комментарий";
        const line = author ? `${snippet} · ${author}` : snippet;
        return truncateText(redactChatPreviewIfSensitive(line), maxLen);
      } catch {
        return "Комментарий";
      }
    }
    case "story_reply": {
      try {
        const p = JSON.parse(c) as { replyText?: string; authorName?: string };
        const rt = (p.replyText || "").trim();
        if (rt) {
          return truncateText(redactChatPreviewIfSensitive(`Ответ на сториз: ${rt}`), maxLen);
        }
        const an = (p.authorName || "").trim();
        return an ? truncateText(`Ответ на сториз · ${an}`, maxLen) : "Ответ на сториз";
      } catch {
        if (/^\s*\{/.test(c) && /"storyId"\s*:/.test(c)) return "Ответ на сториз";
        return truncateText(redactChatPreviewIfSensitive(c), maxLen);
      }
    }
    default: {
      if (/^\s*\{/.test(c) && /"storyId"\s*:/.test(c)) return "Ответ на сториз";
      if (/^\s*\{/.test(c) && /"commentId"\s*:/.test(c) && /"postId"\s*:/.test(c)) return "Комментарий";
      if (/^\s*\{/.test(c) && /"postId"\s*:/.test(c)) return "Пост";
      return truncateText(redactChatPreviewIfSensitive(c), maxLen);
    }
  }
}
