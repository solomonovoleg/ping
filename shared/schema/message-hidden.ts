import { sql } from "drizzle-orm";
import { pgTable, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { chats } from "./chats";

/** Скрытые сообщения «удалено для себя»: пользователь скрыл сообщение у себя, но оно остаётся для других. */
export const messageHidden = pgTable(
  "message_hidden",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    messageId: varchar("message_id").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.userId, t.chatId, t.messageId)]
);

export type MessageHidden = typeof messageHidden.$inferSelect;
export type InsertMessageHidden = typeof messageHidden.$inferInsert;
