import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const CONTENT_REPORT_TARGET_TYPES = ["post", "user", "message"] as const;
export type ContentReportTargetType = (typeof CONTENT_REPORT_TARGET_TYPES)[number];

export const CONTENT_REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];

export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterUserId: varchar("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: varchar("target_type", { length: 32 }).notNull(),
  targetId: text("target_id").notNull(),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("open"),
  adminNote: text("admin_note"),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type ContentReportRow = typeof contentReports.$inferSelect;
