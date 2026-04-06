import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { chats } from "./chats";
import { users } from "./users";
import { chatFolders } from "./chat-folders";

export const messageTypeEnum = [
  "text",
  "system",
  "voice",
  "image",
  "video",
  "video_note",
  "sticker",
  "file",
  "missed_call",
  "post_share",
  "comment_share",
  "story_reply",
] as const;
export type MessageType = (typeof messageTypeEnum)[number];

// Self-referential table: references to messages.id cause circular type inference
// @ts-expect-error TS7022 - circular reference in self-referential table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  /** Папка в групповом чате. null = DM или сообщение до миграции. */
  folderId: varchar("folder_id").references(() => chatFolders.id, { onDelete: "set null" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type", { enum: messageTypeEnum }).notNull().default("text"),
  content: text("content").notNull(),
  /** Расшифровка голосового / видеокружка (ASR), затем переводится как текст при включённом переводе чата */
  transcript: text("transcript"),
  // @ts-expect-error TS7024 - circular reference in callback
  replyToId: varchar("reply_to_id").references(() => messages.id, { onDelete: "set null" }),
  /** Пересланное сообщение: откуда (id сообщения-источника). */
  forwardedFromMessageId: varchar("forwarded_from_message_id").references(() => messages.id, { onDelete: "set null" }),
  /** ID отправителя оригинала (для связи). */
  forwardedFromSenderId: varchar("forwarded_from_sender_id").references(() => users.id, { onDelete: "set null" }),
  /** Имя отправителя в момент пересылки (для подписи «Переслано от X» без джойна). */
  forwardedFromSenderName: text("forwarded_from_sender_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  chatId: true,
  folderId: true,
  senderId: true,
  type: true,
  content: true,
  replyToId: true,
  forwardedFromMessageId: true,
  forwardedFromSenderId: true,
  forwardedFromSenderName: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
