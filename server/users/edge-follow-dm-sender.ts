import { sendChatMessage } from "../messages/service";
import { storage } from "../storage";

function mediaTypeForUrl(url: string): "image" | "video" {
  const n = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(n)) return "video";
  return "image";
}

/**
 * Сообщения от создателя подписчику после follow (конфиг EDGE `followRewardDm`).
 * Ошибки не пробрасываем — follow уже зафиксирован.
 */
export async function sendEdgeFollowRewardDm(params: {
  creatorUserId: string;
  followerUserId: string;
  text: string;
  mediaUrl: string | null;
}): Promise<void> {
  const t = params.text.trim();
  const m = params.mediaUrl?.trim() ?? "";
  if (!t && !m) return;
  try {
    const chat = await storage.getOrCreateDmChat(params.creatorUserId, params.followerUserId);
    if (t) {
      await sendChatMessage({
        userId: params.creatorUserId,
        chatId: chat.id,
        content: t,
        type: "text",
      });
    }
    if (m) {
      await sendChatMessage({
        userId: params.creatorUserId,
        chatId: chat.id,
        content: m,
        type: mediaTypeForUrl(m),
      });
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[edge-follow-dm-sender]", e);
    }
  }
}
