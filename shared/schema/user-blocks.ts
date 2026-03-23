import { sql } from "drizzle-orm";
import { boolean, pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Блокировка: blocker ограничивает blocked.
 * Все три флага true = «полная» блокировка (как раньше): скрытие в ленте, профиль, чат, соц.действия.
 */
export const userBlocks = pgTable(
  "user_blocks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** blocked не видит профиль blocker */
    restrictProfile: boolean("restrict_profile").notNull().default(true),
    /** blocked не может писать blocker в личку */
    restrictChat: boolean("restrict_chat").notNull().default(true),
    /** blocked не может комментировать и реагировать на контент blocker */
    restrictSocial: boolean("restrict_social").notNull().default(true),
    /** Комментарий blocker для blocked (показ при «вы ограничены»), до 500 символов */
    blockNote: varchar("block_note", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.blockerId, t.blockedId)]
);

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = typeof userBlocks.$inferInsert;
