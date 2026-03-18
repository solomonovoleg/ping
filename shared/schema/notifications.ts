import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const NOTIFICATION_TYPES = ["mention", "comment", "reaction", "follow"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Уведомления пользователя (упоминания, комментарии, реакции, подписки) */
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(),
  actorId: varchar("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: varchar("post_id"),
  commentId: varchar("comment_id"),
  /** Краткий текст для превью */
  excerpt: text("excerpt"),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
