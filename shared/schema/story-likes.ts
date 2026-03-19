import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { stories } from "./stories";
import { users } from "./users";

/** Лайки сториз (один пользователь — один лайк на сториз). */
export const storyLikes = pgTable(
  "story_likes",
  {
    storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.userId] })]
);

export type StoryLike = typeof storyLikes.$inferSelect;
export type InsertStoryLike = typeof storyLikes.$inferInsert;
