import type { getDb } from "../db";

/** Экземпляр Drizzle из `getDb()` — общий тип для вынесенных запросов `db-storage-*-queries.ts`. */
export type AppDb = ReturnType<typeof getDb>;
