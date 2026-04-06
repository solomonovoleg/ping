/** Верхняя граница одной выборки «просроченных» для воркера (защита от чрезмерного батча). */
export const SCHEDULED_MESSAGES_DUE_MAX_BATCH = 500;

export function clampScheduledMessagesDueLimit(limit: number): number {
  const n = Number.isFinite(limit) ? Math.floor(limit) : SCHEDULED_MESSAGES_DUE_MAX_BATCH;
  return Math.min(Math.max(n, 1), SCHEDULED_MESSAGES_DUE_MAX_BATCH);
}
