import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

export const chatTypeEnum = ["dm", "group"] as const;
export type ChatType = (typeof chatTypeEnum)[number];

export const chats = pgTable("chats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type", { enum: chatTypeEnum }).notNull().default("dm"),
  name: text("name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMembers = pgTable("chat_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastReadAt: timestamp("last_read_at"),
});

export const insertChatSchema = createInsertSchema(chats).pick({
  type: true,
  name: true,
});

export const insertChatMemberSchema = createInsertSchema(chatMembers).pick({
  chatId: true,
  userId: true,
  role: true,
});

export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertChatMember = z.infer<typeof insertChatMemberSchema>;
export type Chat = typeof chats.$inferSelect;
export type ChatMember = typeof chatMembers.$inferSelect;
