import type { User } from "@shared/schema";
import { storage } from "../storage";

export type MessageUserCandidate = {
  id: string;
  displayName: string | null;
  surname: string | null;
};

/** Внутренний ранг; `matchScore` не отдаём клиенту (см. `stripCandidateScores` в execute). */
export type MessageUserCandidateRanked = MessageUserCandidate & { matchScore: number };

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

/** Один пропущенный символ — типичная ошибка STT для длинных имён. */
function oneCharOmissions(word: string): string[] {
  const w = normalizeWord(word);
  if (w.length < 4) return [];
  const out: string[] = [];
  for (let i = 0; i < w.length; i++) {
    out.push(w.slice(0, i) + w.slice(i + 1));
  }
  return out;
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
    for (const v of withCaseVariants(words[0])) {
      variants.add(v);
      for (const om of oneCharOmissions(v).slice(0, 10)) variants.add(om);
    }
    return Array.from(variants);
  }
  const first = withCaseVariants(words[0]).slice(0, 4);
  for (const fv of first) {
    variants.add([fv, ...words.slice(1)].join(" "));
    for (const om of oneCharOmissions(fv).slice(0, 8)) {
      variants.add([om, ...words.slice(1)].join(" "));
    }
  }
  return Array.from(variants);
}

function fullName(user: Pick<User, "displayName" | "surname">): string {
  return [user.displayName, user.surname].filter(Boolean).join(" ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = cur;
    }
  }
  return row[n]!;
}

/**
 * Насколько произнесённый фрагмент (илоне, маше…) близок к токенам имени/ника.
 * Отделяет «Илона» от «Елена» при похожих общих баллах поиска.
 */
function spokenNameAnchorScore(nameQuery: string, user: User): number {
  const words = normalizeText(nameQuery).split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  const nameTokens = normalizeText(fullName(user))
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
  const nick = normalizeWord(normalizeText(user.nickname ?? ""));
  const targets = [...new Set([...nameTokens, nick].filter(Boolean))];
  let sum = 0;
  for (const w of words.slice(0, 2)) {
    const q = normalizeWord(w);
    if (q.length < 2) continue;
    let best = 0;
    for (const t of targets) {
      if (t === q) best = Math.max(best, 52);
      else if (t.startsWith(q) || q.startsWith(t)) best = Math.max(best, 38);
      else {
        const d = levenshtein(q, t);
        if (d === 1) best = Math.max(best, 32);
        else if (d === 2 && Math.min(q.length, t.length) >= 4) best = Math.max(best, 14);
      }
    }
    sum += best;
  }
  return sum;
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
): Promise<MessageUserCandidateRanked[]> {
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
    .map(({ user, score }) => ({
      user,
      score: score + spokenNameAnchorScore(nameQuery, user),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ user, score }) => ({
      id: user.id,
      displayName: user.displayName,
      surname: user.surname,
      matchScore: score,
    }));
}
