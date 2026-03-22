import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userReminders = pgTable("user_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fireAt: timestamp("fire_at", { withTimezone: true, mode: "date" }).notNull(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type UserReminder = typeof userReminders.$inferSelect;
export type InsertUserReminder = typeof userReminders.$inferInsert;
