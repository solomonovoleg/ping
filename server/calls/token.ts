const TTL_MS = 2 * 60 * 1000; // 2 минуты — даём время на медленный upgrade

const tokens = new Map<
  string,
  { userId: string; expiresAt: number }
>();

function randomToken(): string {
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
  tokens.set(token, { userId, expiresAt: Date.now() + TTL_MS });
  return token;
}

export function consumeCallToken(token: string): string | null {
  const data = tokens.get(token);
  if (!data || data.expiresAt < Date.now()) return null;
  tokens.delete(token);
  return data.userId;
}
