import { pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";
import { stories } from "./stories";
import { users } from "./users";

/** Просмотры сторис (один пользователь — один просмотр на сториз) */
export const storyViews = pgTable(
  "story_views",
  {
    storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.userId] })]
);

export type StoryView = typeof storyViews.$inferSelect;
export type InsertStoryView = typeof storyViews.$inferInsert;
