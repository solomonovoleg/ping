/** Id сориза для API/UI: в цепочке из ленты иногда попадает number (`idx`). */
export function normalizeStorySlideId(id: string | number | undefined | null): string | null {
  if (id === undefined || id === null) return null;
  const s = String(id).trim();
  return s.length > 0 ? s : null;
}

export function formatStoryRemainingShort(expiresAt: Date | null): string | null {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

export function viewsWordRu(n: number): string {
  const n100 = n % 100;
  if (n100 >= 11 && n100 <= 14) return "просмотров";
  const n10 = n % 10;
  if (n10 === 1) return "просмотр";
  if (n10 >= 2 && n10 <= 4) return "просмотра";
  return "просмотров";
}
