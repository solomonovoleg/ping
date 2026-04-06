/** Заполняет каждый календарный день UTC в окне [start, start+safeDays) значением из map (0 если нет). */
export function buildUtcRegistrationDaySeries(
  startUtcMidnight: Date,
  safeDays: number,
  countsByDay: Map<string, number>,
): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = 0; i < safeDays; i++) {
    const d = new Date(startUtcMidnight);
    d.setUTCDate(startUtcMidnight.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: countsByDay.get(key) ?? 0 });
  }
  return out;
}
