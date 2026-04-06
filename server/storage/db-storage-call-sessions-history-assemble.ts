const DEFAULT_CALL_SESSION_LIST_CHAT_NAME = "Созвон";

export function mergeCallSessionsHistoryRowsWithMeta<R extends { id: string; chatId: string }>(
  rows: R[],
  participantCountByCallId: Map<string, number>,
  chatNameByChatId: Map<string, string>,
): Array<R & { participantCount: number; chatName: string }> {
  return rows.map((row) => ({
    ...row,
    participantCount: participantCountByCallId.get(row.id) ?? 0,
    chatName: chatNameByChatId.get(row.chatId) || DEFAULT_CALL_SESSION_LIST_CHAT_NAME,
  }));
}
