import { clearAllChatOfflineStores } from "@/lib/chat-offline-store";
import { clearProfileOfflineStore } from "@/lib/profile-offline-store";

/** После выхода из аккаунта: чаты и чужие профили в IndexedDB (без медиа-кэша и outbox). */
export async function clearSessionOfflineCaches(): Promise<void> {
  await Promise.all([clearAllChatOfflineStores(), clearProfileOfflineStore()]);
}
