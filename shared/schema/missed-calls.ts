import { sql } from "drizzle-orm";
import { boolean, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";

/** Пропущенный звонок (не ответил в течение 30 сек или был офлайн) */
export const missedCalls = pgTable("missed_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  callerId: varchar("caller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  calleeId: varchar("callee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  video: boolean("video").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type MissedCall = typeof missedCalls.$inferSelect;
export type InsertMissedCall = typeof missedCalls.$inferInsert;
