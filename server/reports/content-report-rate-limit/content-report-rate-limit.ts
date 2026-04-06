/** Fixed 1h window per userId; in-process only (resets on deploy). */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function allowContentReportForUser(userId: string): boolean {
  const now = Date.now();
  let b = buckets.get(userId);
  if (!b || now >= b.resetAt) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
}
