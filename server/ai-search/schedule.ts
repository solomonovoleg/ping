import { ingestChat } from "./ingest";

const pending = new Map<string, Set<string>>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 25_000;

/**
 * Дебаунс по пользователю: накапливаем chatId, один прогон модели на пачку чатов.
 */
export function scheduleAiSearchIngest(userId: string, chatId: string): void {
  if (!process.env.DATABASE_URL) return;
  let set = pending.get(userId);
  if (!set) {
    set = new Set();
    pending.set(userId, set);
  }
  set.add(chatId);
  const prev = timers.get(userId);
  if (prev) clearTimeout(prev);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      const chats = pending.get(userId);
      pending.delete(userId);
      if (!chats?.size) return;
      void (async () => {
        for (const cid of chats) {
          try {
            await ingestChat(userId, cid);
          } catch (e) {
            console.warn("[ai-search] ingest", cid, e instanceof Error ? e.message : e);
          }
        }
      })();
    }, DEBOUNCE_MS)
  );
}
