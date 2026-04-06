import { storage } from "../storage";

export async function searchMessagesForUser(userId: string, q: string) {
  const list = await storage.searchMessages(userId, q, 30);
  return list.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
