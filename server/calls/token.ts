import { randomBytes, randomUUID } from "node:crypto";

export const CALL_TOKEN_TTL_MS = 2 * 60 * 1000; // 2 минуты — даём время на медленный upgrade

const tokens = new Map<
  string,
  { userId: string; expiresAt: number }
>();

function randomToken(): string {
  return `${randomBytes(24).toString("hex")}${randomUUID().replace(/-/g, "")}`;
}

function prune(): void {
  const now = Date.now();
  Array.from(tokens.entries()).forEach(([t, data]) => {
    if (data.expiresAt < now) tokens.delete(t);
  });
}

export function createCallToken(userId: string): string {
  prune();
  const token = randomToken();
  tokens.set(token, { userId, expiresAt: Date.now() + CALL_TOKEN_TTL_MS });
  return token;
}

export function consumeCallToken(token: string): string | null {
  const data = tokens.get(token);
  if (!data || data.expiresAt < Date.now()) return null;
  tokens.delete(token);
  return data.userId;
}
