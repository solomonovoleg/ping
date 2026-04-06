/**
 * Колбэки фасада в query-слой: `.bind(storage)` даёт стабильные ссылки без новых замыканий на каждый вызов.
 * Экземпляр `DbStorage` держит `db` и `pool` отдельно (один `getDb()` / `getPool()` на инстанс).
 */
import type { IStorage } from "./types";

/** Методы `IStorage`, которые query-модули принимают как зависимости. */
export type DbStorageFacadeQueryCallbacks = Pick<
  IStorage,
  | "dismissUserReminder"
  | "getChatById"
  | "getChatFolder"
  | "getChatMemberIds"
  | "getUser"
  | "updateUserReminderFireAt"
  | "upsertChatMemberPrefs"
>;

export function createDbStorageFacadeQueryCallbacks(storage: IStorage): DbStorageFacadeQueryCallbacks {
  return {
    dismissUserReminder: storage.dismissUserReminder.bind(storage),
    getChatById: storage.getChatById.bind(storage),
    getChatFolder: storage.getChatFolder.bind(storage),
    getChatMemberIds: storage.getChatMemberIds.bind(storage),
    getUser: storage.getUser.bind(storage),
    updateUserReminderFireAt: storage.updateUserReminderFireAt.bind(storage),
    upsertChatMemberPrefs: storage.upsertChatMemberPrefs.bind(storage),
  };
}
