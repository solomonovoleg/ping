import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { messages } from "./messages";
import { users } from "./users";

/** Сохранённые сообщения (избранное): пользователь сохраняет сообщение из чата для быстрого доступа. */
export const savedMessages = pgTable(
  "saved_messages",
  {
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").notNull(),
    savedAt: timestamp("saved_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.messageId] })]
);

export type SavedMessage = typeof savedMessages.$inferSelect;
export type InsertSavedMessage = typeof savedMessages.$inferInsert;
