import { previewSavedMessageListContent } from "./db-storage-saved-message-list-preview";

export type SavedMessageJoinRow = {
  messageId: string;
  chatId: string;
  savedAt: Date;
  content: string | null;
  type: string;
};

export function mapSavedMessageRowsToListResults(
  rows: SavedMessageJoinRow[],
  chatNames: Map<string, string>,
): {
  messageId: string;
  chatId: string;
  savedAt: Date;
  content: string;
  type: string;
  chatName: string;
}[] {
  return rows.map((r) => ({
    messageId: r.messageId,
    chatId: r.chatId,
    savedAt: r.savedAt,
    content: previewSavedMessageListContent(r.type, r.content ?? ""),
    type: r.type,
    chatName: chatNames.get(r.chatId) || "Чат",
  }));
}
