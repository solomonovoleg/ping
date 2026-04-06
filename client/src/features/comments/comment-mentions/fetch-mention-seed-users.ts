import { fetchFollowing, listContactsWithProfiles, type ContactUser } from "@/lib/users";

/** Контакты и подписки — приоритетные подсказки при пустом запросе после @. */
export async function fetchMentionSeedUsers(currentUserId: string): Promise<ContactUser[]> {
  const [contacts, following] = await Promise.all([
    listContactsWithProfiles(),
    fetchFollowing(currentUserId, 120, 0),
  ]);
  const byId = new Map<string, ContactUser>();
  for (const c of contacts) byId.set(c.id, c);
  for (const f of following) {
    if (!byId.has(f.id)) byId.set(f.id, f);
  }
  const contactIds = new Set(contacts.map((c) => c.id));
  return [...byId.values()].sort((a, b) => {
    const ac = contactIds.has(a.id) ? 0 : 1;
    const bc = contactIds.has(b.id) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const na = [a.displayName, a.surname].filter(Boolean).join(" ") || String(a.publicId);
    const nb = [b.displayName, b.surname].filter(Boolean).join(" ") || String(b.publicId);
    return na.localeCompare(nb, "ru");
  });
}
