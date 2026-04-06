import { MessagesServiceError } from "../messages/messages-service-error";
import { canUserSendSticker, getStickerForSendValidation } from "./repo";

/**
 * Клиент передаёт JSON с stickerId. URL подставляем с сервера (нельзя подменить чужой приватный стикер).
 */
export async function resolveStickerMessageContent(userId: string, rawContent: string): Promise<string> {
  const trimmed = rawContent.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new MessagesServiceError(400, "Некорректный формат стикера");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new MessagesServiceError(400, "Некорректный формат стикера");
  }
  const stickerId = (parsed as { stickerId?: unknown }).stickerId;
  if (typeof stickerId !== "string" || !stickerId.trim()) {
    throw new MessagesServiceError(400, "Укажите stickerId");
  }
  const row = await getStickerForSendValidation(stickerId.trim());
  if (!row) {
    throw new MessagesServiceError(404, "Стикер не найден");
  }
  if (!canUserSendSticker(row.pack, userId)) {
    throw new MessagesServiceError(403, "Этот стикер недоступен");
  }
  return JSON.stringify({
    stickerId: row.sticker.id,
    packId: row.pack.id,
    imageUrl: row.sticker.imageUrl,
  });
}
