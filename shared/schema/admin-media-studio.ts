import { sql } from "drizzle-orm";
import { bigint, boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { chats } from "./chats";
import { posts } from "./posts";

/** Кампания публикации контента от имени studio users */
export const adminMediaStudioCampaigns = pgTable("admin_media_studio_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdByAdminId: varchar("created_by_admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Подпись в UI админки (не обязательна) */
  title: text("title"),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  scheduleMode: varchar("schedule_mode", { length: 32 }),
  scheduleIntervalSecondsMin: integer("schedule_interval_seconds_min"),
  scheduleIntervalSecondsMax: integer("schedule_interval_seconds_max"),
  shuffleSeed: bigint("shuffle_seed", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Элемент очереди поста внутри кампании */
export const adminMediaStudioCampaignPosts = pgTable("admin_media_studio_campaign_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id")
    .notNull()
    .references(() => adminMediaStudioCampaigns.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
  authorUserId: varchar("author_user_id").references(() => users.id, { onDelete: "set null" }),
  bodyText: text("body_text"),
  mediaUrls: jsonb("media_urls").notNull().default(sql`'[]'::jsonb`),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }),
  publishedPostId: varchar("published_post_id").references(() => posts.id, { onDelete: "set null" }),
  state: varchar("state", { length: 32 }).notNull().default("queued"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Приглашение в групповой чат по секретному токену (храним только hash) */
export const adminMediaStudioGroupInvites = pgTable("admin_media_studio_group_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
  createdByAdminId: varchar("created_by_admin_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
  maxMembers: integer("max_members"),
  revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
});

export type AdminMediaStudioCampaign = typeof adminMediaStudioCampaigns.$inferSelect;
export type AdminMediaStudioCampaignPost = typeof adminMediaStudioCampaignPosts.$inferSelect;
export type AdminMediaStudioGroupInvite = typeof adminMediaStudioGroupInvites.$inferSelect;
