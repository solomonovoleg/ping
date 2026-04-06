import type { Pool } from "pg";
import type { AppDb } from "./db-app-db";
import type { DbStorageFacadeQueryCallbacks } from "./db-storage-facade-context";
import type { ChatNameResolverDeps } from "./db-storage-message-search-saved-queries";

/** Среда фасада для сегментов; по полям совпадает с `DbStorage` (приватные поля класса не структурно видны снаружи — в классе используется приведение). */
export type DbStorageSegmentHost = {
  readonly db: AppDb;
  readonly pool: Pool;
  readonly facadeCallbacks: DbStorageFacadeQueryCallbacks;
  chatNameDeps(): ChatNameResolverDeps;
};
