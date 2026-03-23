import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Каждое открытие чужого профиля (для статистики владельца): один зритель может иметь много строк. */
export const profilePageViews = pgTable(
  "profile_page_views",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    profileUserId: varchar("profile_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewerUserId: varchar("viewer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    viewedAt: timestamp("viewed_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_profile_page_views_profile_time").on(t.profileUserId, t.viewedAt),
    index("idx_profile_page_views_profile_viewer").on(t.profileUserId, t.viewerUserId),
  ],
);

export type ProfilePageView = typeof profilePageViews.$inferSelect;
export type InsertProfilePageView = typeof profilePageViews.$inferInsert;
