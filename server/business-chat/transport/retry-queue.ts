export function calcNextRetryAt(attemptCount: number): Date {
  const safeAttempt = Math.max(1, attemptCount);
  const baseMs = 2_000;
  const delayMs = Math.min(120_000, baseMs * 2 ** Math.min(safeAttempt, 6));
  return new Date(Date.now() + delayMs);
}
