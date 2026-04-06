export function pluckHiddenMessageIds(rows: { messageId: string }[]): string[] {
  return rows.map((r) => r.messageId);
}
