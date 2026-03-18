/**
 * Токены для мобильного приложения (Expo/React Native).
 * В браузере используется сессия (cookie), в приложении — Bearer token.
 */
const tokens = new Map<string, { userId: string; exp: number }>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

function prune() {
  const now = Date.now();
  Array.from(tokens.entries()).forEach(([token, data]) => {
    if (data.exp < now) tokens.delete(token);
  });
}

export function createToken(userId: string): string {
  prune();
  const token = `pm_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  tokens.set(token, { userId, exp: Date.now() + TTL_MS });
  return token;
}

export function getUserIdByToken(token: string): string | null {
  const data = tokens.get(token);
  if (!data || data.exp < Date.now()) return null;
  return data.userId;
}
