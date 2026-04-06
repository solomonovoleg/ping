/** Презентация пуша для исходящих сообщений в чат (ЛС / группы). */

export const PUSH_ANDROID_CHANNEL_DM = "ping_dm";
export const PUSH_ANDROID_CHANNEL_STORY_MENTION = "ping_story_mention";

export type DmPushPayload = {
  title: string;
  body: string;
  androidChannelId: string;
  /** iOS: имя файла в бандле (CAF/WAV/AIF, до ~30 с). Пока файла нет — iOS играет стандартный звук. */
  iosSound?: string;
  /** Строковые пары для FCM data (клиент / натив). */
  dataFields: Record<string, string>;
};

function bodyPreviewForType(type: string, content: string): string {
  if (type === "text") return String(content).slice(0, 80);
  if (type === "system") return String(content).slice(0, 80);
  if (type === "voice") return "Голосовое сообщение";
  if (type === "video_note") return "Видеокружок";
  if (type === "file") return "PDF-документ";
  if (type === "post_share") return "Пересланный пост";
  if (type === "comment_share") return "Пересланный комментарий";
  if (type === "story_reply") return "Ответ на сториз";
  if (type === "sticker") return "Стикер";
  return "Фото/медиа";
}

/**
 * Заголовок, текст и канал Android: для отметки в сторис — отдельно от обычного сообщения.
 */
export function buildDmPushPayload(type: string, content: string, senderName: string): DmPushPayload {
  const name = senderName.trim() || "Сообщение";

  if (type === "story_reply") {
    let firstLine = "";
    try {
      const trimmed = String(content).trim();
      if (trimmed.startsWith("{")) {
        const p = JSON.parse(trimmed) as { replyText?: unknown };
        if (typeof p.replyText === "string" && p.replyText.trim()) {
          firstLine = p.replyText.trim().split(/\r?\n/)[0]?.slice(0, 120) ?? "";
        }
      }
    } catch {
      /* не JSON — оставим пусто */
    }
    const body = firstLine ? `${name}: ${firstLine}` : `${name} отметил(а) вас в истории`;
    return {
      title: "Отметка в истории",
      body,
      androidChannelId: PUSH_ANDROID_CHANNEL_STORY_MENTION,
      iosSound: "story_mention.caf",
      dataFields: {
        ping_push_kind: "story_mention",
        ping_msg_type: "story_reply",
      },
    };
  }

  return {
    title: name,
    body: bodyPreviewForType(type, content),
    androidChannelId: PUSH_ANDROID_CHANNEL_DM,
    dataFields: {
      ping_push_kind: "chat_message",
      ping_msg_type: type,
    },
  };
}
