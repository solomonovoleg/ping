import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { chats } from "./chats";
import { users } from "./users";

export const messageTypeEnum = ["text", "system", "voice", "image", "video", "missed_call", "post_share"] as const;
export type MessageType = (typeof messageTypeEnum)[number];

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  type: text("type", { enum: messageTypeEnum }).notNull().default("text"),
  content: text("content").notNull(),
  replyToId: varchar("reply_to_id").references(() => messages, { onDelete: "set null" }),
  /** Пересланное сообщение: откуда (id сообщения-источника). */
  forwardedFromMessageId: varchar("forwarded_from_message_id").references(() => messages.id, { onDelete: "set null" }),
  /** ID отправителя оригинала (для связи). */
  forwardedFromSenderId: varchar("forwarded_from_sender_id").references(() => users.id, { onDelete: "set null" }),
  /** Имя отправителя в момент пересылки (для подписи «Переслано от X» без джойна). */
  forwardedFromSenderName: text("forwarded_from_sender_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  chatId: true,
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
