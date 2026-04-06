const RATE_MS = 45_000;
const lastIssueAt = new Map<string, number>();

function key(userId: string, edgeId: string): string {
  return `${userId}\n${edgeId}`;
}

export function rateLimitMoneyInviteIssue(
  userId: string,
  edgeId: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const k = key(userId, edgeId);
  const prev = lastIssueAt.get(k) ?? 0;
  const delta = Date.now() - prev;
  if (delta < RATE_MS) {
    return { ok: false, retryAfterSec: Math.ceil((RATE_MS - delta) / 1000) };
  }
  return { ok: true };
}

export function markMoneyInviteIssued(userId: string, edgeId: string): void {
  lastIssueAt.set(key(userId, edgeId), Date.now());
}
