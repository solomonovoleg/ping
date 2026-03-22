import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";

/**
 * Персональные настройки чата в списке: закрепление, скрытие, «полка» (друзья / работа / реклама).
 * Не путать с папками сообщений внутри группового чата (`chat_folders`).
 */
export const chatMemberPrefs = pgTable(
  "chat_member_prefs",
  {
    chatId: varchar("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: "date" }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true, mode: "date" }),
    listSection: varchar("list_section", { length: 32 }).notNull().default("general"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.chatId, t.userId] })]
);

export type ChatMemberPrefs = typeof chatMemberPrefs.$inferSelect;
export type InsertChatMemberPrefs = typeof chatMemberPrefs.$inferInsert;

/** Допустимые значения list_section для API */
export const CHAT_LIST_SECTIONS = ["general", "friends", "work", "promo"] as const;
export type ChatListSection = (typeof CHAT_LIST_SECTIONS)[number];
