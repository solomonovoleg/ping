import { sql } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";

/** Очередь «пульса передачи» для собеседника без активной WS-подписки на чат. */
export const composerPulsePending = pgTable("composer_pulse_pending", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  fromUserId: varchar("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: varchar("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

export type ComposerPulsePending = typeof composerPulsePending.$inferSelect;
