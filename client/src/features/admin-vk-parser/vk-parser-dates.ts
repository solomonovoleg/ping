/** Короткая подпись «когда» для карточек очереди (RU). */
export function formatVkParserRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t);
  const diff = Date.now() - t;
  if (diff < 45_000) return "только что";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m} мин назад`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} ч назад`;
  }
  if (diff < 7 * 86_400_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days} дн. назад`;
  }
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
