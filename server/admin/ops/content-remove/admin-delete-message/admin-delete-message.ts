import { scheduleApiHubBridgeMessageDeleted } from "../../../../integrations/api-hub-bridge";
import { notifyMessageDeleted } from "../../../../realtime/chat";
import { storage } from "../../../../storage";

export async function adminDeleteChatMessage(
  chatId: string,
  messageId: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 400 }> {
  const c = chatId.trim();
  const m = messageId.trim();
  if (!c || !m) return { ok: false, status: 400 };
  const msg = await storage.getMessage(c, m);
  if (!msg) return { ok: false, status: 404 };
  const deleted = await storage.deleteMessage(c, m);
  if (!deleted) return { ok: false, status: 404 };
  notifyMessageDeleted(c, m);
  const memberIds = await storage.getChatMemberIds(c);
  scheduleApiHubBridgeMessageDeleted(c, m, memberIds);
  return { ok: true };
}
