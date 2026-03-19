import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";
import { messages } from "./messages";

/** Отложенные сообщения: отправляются в scheduled_at. */
export const scheduledMessages = pgTable("scheduled_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  folderId: varchar("folder_id"),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type").notNull().default("text"),
  content: text("content").notNull(),
  replyToId: varchar("reply_to_id").references(() => messages.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ScheduledMessage = typeof scheduledMessages.$inferSelect;
export type InsertScheduledMessage = typeof scheduledMessages.$inferInsert;
