import { sql } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Закладки постов (сохранённое) */
export const savedPosts = pgTable(
  "saved_posts",
  {
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    postId: varchar("post_id").notNull(),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.postId] })]
);

export type SavedPost = typeof savedPosts.$inferSelect;
export type InsertSavedPost = typeof savedPosts.$inferInsert;
