import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { postComments } from "./comments";
import { users } from "./users";

/** Лайки комментариев к постам (один пользователь — один лайк на комментарий, переключение через POST). */
export const postCommentLikes = pgTable(
  "post_comment_likes",
  {
    commentId: varchar("comment_id")
      .notNull()
      .references(() => postComments.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })]
);

export type PostCommentLike = typeof postCommentLikes.$inferSelect;
export type InsertPostCommentLike = typeof postCommentLikes.$inferInsert;
