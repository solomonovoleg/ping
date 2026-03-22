import type { ApiChatMember } from "../types";

export const memberDisplayName = (m: ApiChatMember) =>
  [m.displayName, m.surname].filter(Boolean).join(" ") || `ID ${m.publicId ?? ""}`;

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
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter((m) => {
    const name = memberDisplayName(m).toLowerCase();
    const pid = String(m.publicId ?? "");
    if (name.includes(q)) return true;
    if (pid && (pid.includes(q) || pid.startsWith(q))) return true;
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
