import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const stickerPackVisibilityEnum = ["private", "public"] as const;
export type StickerPackVisibility = (typeof stickerPackVisibilityEnum)[number];

export const stickerPacks = pgTable("sticker_packs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  visibility: varchar("visibility", { length: 16 }).notNull().default("private"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const stickers = pgTable("stickers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packId: varchar("pack_id")
    .notNull()
    .references(() => stickerPacks.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type StickerPackRow = typeof stickerPacks.$inferSelect;
export type StickerRow = typeof stickers.$inferSelect;
