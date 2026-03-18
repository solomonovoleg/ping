import { sql } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

/** Реакции пользователей на посты (один пользователь — одна реакция на пост, можно менять эмодзи) */
export const postReactions = pgTable(
  "post_reactions",
  {
    postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 20 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export type PostReaction = typeof postReactions.$inferSelect;
export type InsertPostReaction = typeof postReactions.$inferInsert;
