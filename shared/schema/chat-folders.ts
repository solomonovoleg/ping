import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";

/** Папки в групповом чате: основной поток (Общий) + второстепенные топики. */
export const chatFolders = pgTable("chat_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Основная папка = общий поток чата. Одна на группу. */
  isMain: boolean("is_main").notNull().default(false),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ChatFolder = typeof chatFolders.$inferSelect;
export type InsertChatFolder = typeof chatFolders.$inferInsert;
