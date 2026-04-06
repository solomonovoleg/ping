export function referralCountsByInviter(
  userIds: string[],
  rows: { invitedById: string | null; count: number }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of userIds) out[id] = 0;
  for (const r of rows) if (r.invitedById) out[r.invitedById] = r.count;
  return out;
}
