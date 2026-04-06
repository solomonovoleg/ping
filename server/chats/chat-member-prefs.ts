import { notifyChatListUpdate } from "../calls/ws";
import { storage } from "../storage";
import { ChatsServiceError } from "./chats-service-error";
import { normalizeListSectionForApiUser } from "./chat-list-section";

export async function updateChatMemberPrefsForUser(
  userId: string,
  chatId: string,
  body: { pinned?: boolean; hidden?: boolean; listSection?: string },
) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа к чату");

  const patch: { pinnedAt?: Date | null; hiddenAt?: Date | null; listSection?: string } = {};
  if (body.pinned === true) patch.pinnedAt = new Date();
  if (body.pinned === false) patch.pinnedAt = null;
  if (body.hidden === true) patch.hiddenAt = new Date();
  if (body.hidden === false) patch.hiddenAt = null;
  if (body.listSection !== undefined) patch.listSection = await normalizeListSectionForApiUser(userId, body.listSection);

  if (Object.keys(patch).length === 0) throw new ChatsServiceError(400, "Нет полей для обновления");
  await storage.upsertChatMemberPrefs(userId, chatId, patch);
  notifyChatListUpdate(userId);
  return { ok: true };
}
