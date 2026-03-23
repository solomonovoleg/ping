import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";
import { userReminders } from "./user-reminders";

export const dmScheduledCalls = pgTable("dm_scheduled_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  peerUserId: varchar("peer_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plannerReminderId: varchar("planner_reminder_id").references(() => userReminders.id, { onDelete: "set null" }),
  fireAt: timestamp("fire_at", { withTimezone: true, mode: "date" }).notNull(),
  title: text("title").notNull(),
  initiatorDismissedAt: timestamp("initiator_dismissed_at", { withTimezone: true, mode: "date" }),
  peerDismissedAt: timestamp("peer_dismissed_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type DmScheduledCall = typeof dmScheduledCalls.$inferSelect;
