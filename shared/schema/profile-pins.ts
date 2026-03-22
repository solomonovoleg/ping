import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { stories } from "./stories";
import { users } from "./users";

/** Папка «Закреплённое» на профиле */
export const profilePinFolders = pgTable("profile_pin_folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  coverIsVideo: boolean("cover_is_video").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Элемент папки: пост, сториз или загруженное медиа (kind = media) */
export const profilePinItems = pgTable("profile_pin_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  folderId: varchar("folder_id")
    .notNull()
    .references(() => profilePinFolders.id, { onDelete: "cascade" }),
  ownerUserId: varchar("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 10 }).notNull(),
  postId: varchar("post_id").references(() => posts.id, { onDelete: "cascade" }),
  storyId: varchar("story_id").references(() => stories.id, { onDelete: "cascade" }),
  /** Прямая загрузка фото/видео в папку (kind = media) */
  mediaUrl: text("media_url"),
  mediaIsVideo: boolean("media_is_video").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type ProfilePinFolder = typeof profilePinFolders.$inferSelect;
export type ProfilePinItem = typeof profilePinItems.$inferSelect;
