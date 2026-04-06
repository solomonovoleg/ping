import { storage } from "../storage";

/** Не слать push о новом сообщении в чате, если у получателя эта полка с mute push. */
export async function shouldSkipChatDmPushForRecipient(recipientId: string, chatId: string): Promise<boolean> {
  const section = await storage.getChatMemberListSection(recipientId, chatId);
  return storage.isChatListSectionPushMutedForUser(recipientId, section);
}
