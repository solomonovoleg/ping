import { redactChatPreviewIfSensitive } from "@shared/sensitive-message-preview";
import { formatDateShortLocal, formatTimeLocal, parseServerTimestamp } from "@/lib/timezone";

export function formatChatTime(createdAt: string): string {
  const d = parseServerTimestamp(createdAt);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return formatTimeLocal(d);
  if (diff < 172800000) return "Вчера";
  return formatDateShortLocal(d);
}

/** Превью в списке чатов: не показывать сырые пути /uploads/… и секреты (дублируем сервер для кэша/офлайна). */
export function formatChatLastMessagePreview(last: { type: string; content: string } | null | undefined): string {
  if (!last) return "Нет сообщений";
  const { type, content } = last;
  const c = typeof content === "string" ? content : "";
  if (type === "voice") return "Голосовое сообщение";
  if (type === "image") return "Фото";
  if (type === "sticker") return "Стикер";
  if (type === "video") return "Видео";
  if (type === "video_note") return "Видеокружок";
  if (type === "file" || type === "document") return "PDF-документ";
  if (type === "text" || !type) {
    const t = c.trim();
    if (!t) return "Сообщение";
    if (t.startsWith("/uploads/") || t.startsWith("http://") || t.startsWith("https://")) {
      if (t.includes("/voice/") || /\.(webm|m4a|ogg|opus|wav)(\?|$)/i.test(t)) return "Голосовое сообщение";
      if (t.includes("/chat/") || t.includes("/image") || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(t)) return "Фото";
      if (t.includes("/video/") || /\.(mp4|mov|webm)(\?|$)/i.test(t)) return "Видео";
      return "Вложение";
    }
    return redactChatPreviewIfSensitive(c);
  }
  return "Сообщение";
}
