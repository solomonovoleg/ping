import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

/** Уникальные просмотры поста (один пользователь — один просмотр) */
export const postViews = pgTable(
  "post_views",
  {
    postId: varchar("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })]
);

export type PostView = typeof postViews.$inferSelect;
export type InsertPostView = typeof postViews.$inferInsert;
