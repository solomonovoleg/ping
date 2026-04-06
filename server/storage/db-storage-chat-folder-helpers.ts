import type { InsertChatFolder } from "@shared/schema";

export const MAIN_CHAT_FOLDER_DISPLAY_NAME = "Общий";

export function buildMainChatFolderInsertValues(chatId: string): InsertChatFolder {
  return { chatId, name: MAIN_CHAT_FOLDER_DISPLAY_NAME, isMain: true, orderIndex: 0 };
}

export function trimChatFolderCreateName(name: string): string {
  return name.trim();
}

/** Переименование: пустая строка / только пробелы → не меняем (как в `updateChatFolder`). */
export function decideChatFolderRename(data: { name?: string }): { apply: false } | { apply: true; name: string } {
  if (data.name === undefined) return { apply: false };
  const t = data.name.trim();
  if (t.length === 0) return { apply: false };
  return { apply: true, name: t };
}
