import type { User } from "@shared/schema";
import { storage } from "../storage";

export type MessageUserCandidate = {
  id: string;
  displayName: string | null;
  surname: string | null;
};

function normalizeWord(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, "");
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()[\]{}"'`~*_/\\|+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withCaseVariants(word: string): string[] {
  const w = normalizeWord(word);
  if (!w) return [];
  const out = new Set<string>([w]);
  const add = (v: string) => {
    if (v && v.length >= 2) out.add(v);
  };
  if (w.endsWith("е") || w.endsWith("у") || w.endsWith("ой") || w.endsWith("ом")) add(w.replace(/(е|у|ой|ом)$/i, "а"));
  if (w.endsWith("и") || w.endsWith("е") || w.endsWith("ей") || w.endsWith("ю")) add(w.replace(/(и|е|ей|ю)$/i, "я"));
  if (w.length > 4) add(w.slice(0, -1));
  if (w.length > 5) add(w.slice(0, -2));
  return Array.from(out);
}

function buildQueryVariants(raw: string): string[] {
  const n = normalizeText(raw);
  if (!n) return [];
  const words = n.split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const variants = new Set<string>([n]);
  if (words.length === 1) {
    for (const v of withCaseVariants(words[0])) variants.add(v);
    return Array.from(variants);
  }
  const first = withCaseVariants(words[0]).slice(0, 4);
  for (const fv of first) variants.add([fv, ...words.slice(1)].join(" "));
  return Array.from(variants);
}

function fullName(user: Pick<User, "displayName" | "surname">): string {
  return [user.displayName, user.surname].filter(Boolean).join(" ").trim();
}

function tokenMatchScore(queryRaw: string, user: Pick<User, "displayName" | "surname" | "nickname">): number {
  const q = normalizeText(queryRaw);
  const name = normalizeText(fullName(user));
  const nick = normalizeText(user.nickname ?? "");
  if (!q) return 0;
  let score = 0;
  if (name === q || nick === q) score += 120;
  if (name.startsWith(q) || nick.startsWith(q)) score += 75;
  if (name.includes(q) || nick.includes(q)) score += 55;
  const qWords = q.split(" ").filter(Boolean);
  const targetWords = `${name} ${nick}`.trim().split(" ").filter(Boolean);
  for (const qw of qWords) {
    const qVars = withCaseVariants(qw);
    const matched = targetWords.some((tw) => qVars.some((v) => tw.startsWith(v) || v.startsWith(tw)));
    if (matched) score += 18;
  }
  return score;
}

async function collectRecentChatPeers(userId: string): Promise<User[]> {
  const chats = await storage.getChatsForUser(userId);
  const uniq = new Map<string, User>();
  for (const chat of chats) {
    const ids = await storage.getChatMemberIds(chat.id);
    for (const memberId of ids) {
      if (memberId === userId || uniq.has(memberId)) continue;
      const u = await storage.getUser(memberId);
      if (!u || u.isBlocked || u.deletedAt) continue;
      uniq.set(memberId, u);
    }
  }
  return Array.from(uniq.values());
}

/**
 * Поиск кандидатов для voice-message: учитываем падежи/вариации имени
 * и приоритизируем людей, с кем уже были общие чаты.
 */
export async function findMessageUserCandidates(
  userId: string,
  nameQuery: string,
): Promise<MessageUserCandidate[]> {
  const queryVariants = buildQueryVariants(nameQuery);
  const byId = new Map<string, { user: User; score: number }>();

  for (const q of queryVariants) {
    const users = await storage.searchUsers(q, userId);
    for (const u of users) {
      const score = tokenMatchScore(nameQuery, u) + 20;
      const prev = byId.get(u.id);
      if (!prev || score > prev.score) byId.set(u.id, { user: u, score });
    }
  }

  const chatPeers = await collectRecentChatPeers(userId);
  for (const u of chatPeers) {
    const score = tokenMatchScore(nameQuery, u) + 35;
    if (score <= 35) continue;
    const prev = byId.get(u.id);
    if (!prev || score > prev.score) byId.set(u.id, { user: u, score });
  }

  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ user }) => ({
      id: user.id,
      displayName: user.displayName,
      surname: user.surname,
    }));
}
