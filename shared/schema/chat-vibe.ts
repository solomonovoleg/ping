import { sql } from "drizzle-orm";
import { boolean, integer, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";

export const chatVibeState = pgTable("chat_vibe_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .notNull()
    .unique()
    .references(() => chats.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("casual"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull().default("0"),
  warmth: integer("warmth").notNull().default(50),
  tension: integer("tension").notNull().default(10),
  playfulness: integer("playfulness").notNull().default(30),
  intimacy: integer("intimacy").notNull().default(20),
  formality: integer("formality").notNull().default(30),
  energy: integer("energy").notNull().default(40),
  messageCounter: integer("message_counter").notNull().default(0),
  themeVersion: integer("theme_version").notNull().default(1),
  lastBatchAt: timestamp("last_batch_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const chatVibeBatches = pgTable("chat_vibe_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  windowSize: integer("window_size").notNull(),
  dominantPattern: text("dominant_pattern").notNull(),
  secondaryPattern: text("secondary_pattern"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }).notNull(),
  warmth: integer("warmth").notNull(),
  tension: integer("tension").notNull(),
  playfulness: integer("playfulness").notNull(),
  intimacy: integer("intimacy").notNull(),
  formality: integer("formality").notNull(),
  energy: integer("energy").notNull(),
  toxicityFlag: boolean("toxicity_flag").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const chatVibeHistory = pgTable("chat_vibe_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  oldTheme: text("old_theme").notNull(),
  newTheme: text("new_theme").notNull(),
  oldConfidence: numeric("old_confidence", { precision: 5, scale: 2 }).notNull(),
  newConfidence: numeric("new_confidence", { precision: 5, scale: 2 }).notNull(),
  triggerType: text("trigger_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type ChatVibeState = typeof chatVibeState.$inferSelect;
export type ChatVibeBatch = typeof chatVibeBatches.$inferSelect;
export type ChatVibeHistoryEntry = typeof chatVibeHistory.$inferSelect;
