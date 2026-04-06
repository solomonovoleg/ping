/** Единый trim + fallback для напоминаний, голосовых задач и запланированных звонков. */
export function normalizePlannerDisplayTitle(title: string, fallback: string): string {
  const t = title.trim();
  return t || fallback;
}
