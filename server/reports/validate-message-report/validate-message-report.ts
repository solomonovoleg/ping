import { ReportsTargetValidationError } from "../reports-target-validation-error";
import { storage } from "../../storage";

export type MessageReportContext = { contextChatId?: string };

export async function validateMessageReport(
  reporterUserId: string,
  targetId: string,
  ctx?: MessageReportContext,
): Promise<void> {
  const msg = await storage.getMessageById(targetId);
  if (!msg) {
    throw new ReportsTargetValidationError(404, "Сообщение не найдено");
  }
  const expectedChat = ctx?.contextChatId?.trim();
  if (expectedChat && msg.chatId !== expectedChat) {
    throw new ReportsTargetValidationError(400, "Чат не совпадает с сообщением");
  }
  const memberIds = await storage.getChatMemberIds(msg.chatId);
  if (!memberIds.includes(reporterUserId)) {
    throw new ReportsTargetValidationError(403, "Нет доступа к этому сообщению");
  }
  if (msg.senderId && msg.senderId === reporterUserId) {
    throw new ReportsTargetValidationError(400, "Нельзя пожаловаться на своё сообщение");
  }
}
