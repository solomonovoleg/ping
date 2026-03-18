import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { messages } from "./messages";
import { users } from "./users";

/** Реакции на сообщения в чате (один пользователь — одна реакция на сообщение). */
export const messageReactions = pgTable(
  "message_reactions",
  {
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })]
);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = typeof messageReactions.$inferInsert;
