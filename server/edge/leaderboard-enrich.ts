import { inArray } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "@shared/schema";

type RawEntry = {
  rank?: unknown;
  xp?: unknown;
  level?: unknown;
  careStreakDays?: unknown;
  isMe?: unknown;
  platformUserId?: unknown;
};

type RawPayload = {
  edgeId?: unknown;
  entries?: unknown;
  totalParticipants?: unknown;
  myRank?: unknown;
};

function buildDisplayName(row: {
  displayName: string | null;
  surname: string | null;
  nickname: string | null;
}): string {
  const full = [row.displayName, row.surname].filter(Boolean).join(" ").trim();
  if (full) return full;
  const nick = row.nickname?.trim();
  if (nick) return nick;
  return "";
}

/**
 * Подмешивает в JSON лидерборда EDGE публичные поля профиля (`displayName`, `avatarUrl`).
 * Поле `platformUserId` из EDGE в ответе клиенту не включается.
 */
export async function enrichEdgeLeaderboardBodyJson(bodyText: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
  if (!parsed || typeof parsed !== "object") return bodyText;
  const payload = parsed as RawPayload;
  const entries = payload.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    return bodyText;
  }

  const ids = new Set<string>();
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const pid = (item as RawEntry).platformUserId;
    if (typeof pid === "string" && pid.trim()) ids.add(pid.trim());
  }

  const profileById = new Map<string, { displayName: string; avatarUrl: string | null }>();
  if (ids.size > 0) {
    try {
      const db = getDb();
      const idList = [...ids];
      const rows = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          surname: users.surname,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(inArray(users.id, idList));
      for (const r of rows) {
        const dn = buildDisplayName(r);
        profileById.set(r.id, {
          displayName: dn,
          avatarUrl: r.avatarUrl ?? null,
        });
      }
    } catch (e) {
      console.error("[edge] enrichEdgeLeaderboardBodyJson db", e);
    }
  }

  const enrichedEntries = entries.map((item) => {
    if (!item || typeof item !== "object") return item;
    const e = item as RawEntry;
    const rank = typeof e.rank === "number" && Number.isFinite(e.rank) ? e.rank : 0;
    const pid = typeof e.platformUserId === "string" ? e.platformUserId.trim() : "";
    const prof = pid ? profileById.get(pid) : undefined;
    const nameFromProfile = prof?.displayName?.trim() ?? "";
    const displayName = nameFromProfile || (rank > 0 ? `Участник ${rank}` : "Участник");

    return {
      rank: e.rank,
      xp: e.xp,
      level: e.level,
      careStreakDays: e.careStreakDays,
      isMe: e.isMe,
      displayName,
      avatarUrl: prof?.avatarUrl ?? null,
    };
  });

  return JSON.stringify({
    ...payload,
    entries: enrichedEntries,
  });
}
