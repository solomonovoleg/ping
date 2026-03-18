import { sql } from "drizzle-orm";
import { pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Блокировка пользователя (blocker не видит blocked и наоборот) */
export const userBlocks = pgTable(
  "user_blocks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.blockerId, t.blockedId)]
);

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = typeof userBlocks.$inferInsert;
