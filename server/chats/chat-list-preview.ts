import { redactChatPreviewIfSensitive } from "@shared/sensitive-message-preview";

function lastMessageTextSnippet(content: string): string {
  const redacted = redactChatPreviewIfSensitive(content);
  if (redacted !== content) return redacted;
  return content.length > 60 ? `${content.slice(0, 57)}…` : content;
}

export function formatLastMessagePreview(msg: { type: string; content: string }): string {
  const raw = msg.content ?? "";
  if (msg.type === "missed_call") return "Пропущенный звонок";
  if (msg.type === "post_share") return "Пересланный пост";
  if (msg.type === "comment_share") return "Пересланный комментарий";
  if (msg.type === "story_reply") return "Ответ на сториз";
  if (msg.type === "voice") return "Голосовое сообщение";
  if (msg.type === "image") return "Фото";
  if (msg.type === "video") return "Видео";
  if (msg.type === "video_note") return "Видеокружок";
  if (msg.type === "file") return "PDF-документ";
  return lastMessageTextSnippet(raw);
}
