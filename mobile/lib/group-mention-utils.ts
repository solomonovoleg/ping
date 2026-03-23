/**
 * @упоминания в групповом чате (как на вебе: @[Имя](id) и @all).
 */

export type GroupChatMember = {
  id: string;
  publicId?: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl?: string | null;
  role?: string;
};

export type MentionListEntry =
  | { kind: "everyone" }
  | { kind: "member"; member: GroupChatMember };

export function memberDisplayName(m: GroupChatMember): string {
  const name = [m.displayName, m.surname].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (m.publicId != null && m.publicId > 0) return `ID ${m.publicId}`;
  return `Участник ${m.id.slice(0, 8)}`;
}

export function mentionEveryoneVisible(query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (q === "all" || q === "все" || q === "всех") return true;
  if ("all".startsWith(q) && q.length <= 3) return true;
  if ("все".startsWith(q) && q.length <= 4) return true;
  if ("всех".startsWith(q) && q.length <= 4) return true;
  return false;
}

export function filterMembersByMentionQuery(members: GroupChatMember[], query: string): GroupChatMember[] {
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
  members: GroupChatMember[],
  query: string,
  opts?: { includeEveryone?: boolean },
): MentionListEntry[] {
  const rows: MentionListEntry[] = [];
  if (opts?.includeEveryone && mentionEveryoneVisible(query)) {
    rows.push({ kind: "everyone" });
  }
  for (const member of filterMembersByMentionQuery(members, query)) {
    rows.push({ kind: "member", member });
  }
  return rows;
}
