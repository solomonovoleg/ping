import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";

/** Комментарии к постам: привязаны к посту и автору комментария */
// @ts-expect-error TS7022 — self-reference (parent_comment_id → post_comments.id)
export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Ответ на другой комментарий в том же посте (null = корневой комментарий) */
  // @ts-expect-error TS7024 — circular callback
  parentCommentId: varchar("parent_comment_id").references(() => postComments.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = typeof postComments.$inferInsert;
