/** Объединяет id «другой стороны» при полной блокировке: кого я заблокировал и кто меня (без дублей). */
export function mergeBlockedRelationUserIds(
  asBlockerRows: { blockedId: string }[],
  asBlockedRows: { blockerId: string }[],
): string[] {
  const set = new Set<string>();
  for (const r of asBlockerRows) set.add(r.blockedId);
  for (const r of asBlockedRows) set.add(r.blockerId);
  return Array.from(set);
}
