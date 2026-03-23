import type { ApiChatMember } from "../types";

export const memberDisplayName = (m: ApiChatMember) =>
  [m.displayName, m.surname].filter(Boolean).join(" ") ||
  (m.publicId != null && m.publicId > 0 ? `ID ${m.publicId}` : `Участник ${m.id.slice(0, 8)}`);

export type MentionListEntry =
  | { kind: "everyone" }
  | { kind: "member"; member: ApiChatMember };

/** Показывать строку «все» при пустом запросе или при вводе all / все… */
export function mentionEveryoneVisible(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (q === "all" || q === "все" || q === "всех") return true;
  if ("all".startsWith(q) && q.length <= 3) return true;
  if ("все".startsWith(q) && q.length <= 4) return true;
  if ("всех".startsWith(q) && q.length <= 4) return true;
  return false;
}

export function filterMembersByMentionQuery(members: ApiChatMember[], query: string): ApiChatMember[] {
  const raw = query.trim().toLowerCase();
  if (!raw) return members;
  const q = raw.startsWith("id") && /^\d+$/.test(raw.slice(2)) ? raw.slice(2) : raw;
  return members.filter((m) => {
    const name = memberDisplayName(m).toLowerCase();
    const pid = String(m.publicId ?? "");
    const words = name.split(/\s+/).filter(Boolean);
    if (name.includes(raw) || name.includes(q)) return true;
    if (words.some((w) => w.startsWith(raw) || w.startsWith(q))) return true;
    if (pid && (pid.includes(q) || pid.startsWith(q) || raw === `id${pid}`)) return true;
    return false;
  });
}

export function buildMentionList(
  members: ApiChatMember[],
  query: string,
  opts?: { includeEveryone?: boolean },
): MentionListEntry[] {
  const rows: MentionListEntry[] = [];
  if (opts?.includeEveryone && mentionEveryoneVisible(query)) {
    rows.push({ kind: "everyone" });
  }
  const filtered = filterMembersByMentionQuery(members, query);
  for (const member of filtered) {
    rows.push({ kind: "member", member });
  }
  return rows;
}
