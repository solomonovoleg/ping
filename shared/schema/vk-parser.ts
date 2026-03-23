import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";
import type { PostMediaLayout } from "../post-media-layout";

export const VK_PARSER_ITEM_STATUSES = [
  "pending_review",
  "published",
  "rejected",
  "failed",
  "skipped",
] as const;
export type VkParserItemStatus = (typeof VK_PARSER_ITEM_STATUSES)[number];

/** Настройка импорта со стены ВК → посты от имени пользователя платформы */
export const vkParserBindings = pgTable("vk_parser_bindings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platformUserId: varchar("platform_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  vkAccessTokenEnc: text("vk_access_token_enc").notNull(),
  vkOwnerId: text("vk_owner_id").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  parseIntervalMinutes: integer("parse_interval_minutes").notNull().default(30),
  postsPerRun: integer("posts_per_run").notNull().default(5),
  requireModeration: boolean("require_moderation").notNull().default(true),
  visibility: varchar("visibility", { length: 20 }).notNull().default("public"),
  cityLine: text("city_line"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "date" }),
  lastError: text("last_error"),
  lastCreatedCount: integer("last_created_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Элемент очереди парсера */
export const vkParserItems = pgTable("vk_parser_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bindingId: varchar("binding_id")
    .notNull()
    .references(() => vkParserBindings.id, { onDelete: "cascade" }),
  vkPostKey: varchar("vk_post_key", { length: 80 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending_review"),
  postText: text("post_text").notNull().default(""),
  mediaUrls: jsonb("media_urls").$type<string[] | null>(),
  mediaLayout: jsonb("media_layout").$type<PostMediaLayout | null>(),
  platformPostId: varchar("platform_post_id").references(() => posts.id, { onDelete: "set null" }),
  vkPostDate: integer("vk_post_date"),
  rawExcerpt: jsonb("raw_excerpt"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
});

export type VkParserBindingRow = typeof vkParserBindings.$inferSelect;
export type VkParserItemRow = typeof vkParserItems.$inferSelect;
