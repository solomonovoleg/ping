import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { messages } from "./messages";
import { users } from "./users";
import { chats } from "./chats";

export const messageTranslations = pgTable("message_translations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  targetLang: varchar("target_lang", { length: 10 }).notNull(),
  translatedText: text("translated_text").notNull(),
  detectedLang: varchar("detected_lang", { length: 10 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type MessageTranslation = typeof messageTranslations.$inferSelect;

export const chatTranslatePrefs = pgTable("chat_translate_prefs", {
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  targetLang: varchar("target_lang", { length: 10 }).notNull().default("ru"),
});

export type ChatTranslatePref = typeof chatTranslatePrefs.$inferSelect;
