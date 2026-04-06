export type SearchMessageSelectRow = {
  id: string;
  chatId: string;
  type: string;
  content: string | null;
  createdAt: Date;
};

export function mapSearchMessageRowsToResults(
  rows: SearchMessageSelectRow[],
  chatNames: Map<string, string>,
): { messageId: string; chatId: string; type: string; content: string; createdAt: Date; chatName: string }[] {
  return rows.map((r) => ({
    messageId: r.id,
    chatId: r.chatId,
    type: r.type,
    content: r.content ?? "",
    createdAt: r.createdAt,
    chatName: chatNames.get(r.chatId) || "Чат",
  }));
}
