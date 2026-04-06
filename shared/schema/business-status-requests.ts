import { pgTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const BUSINESS_STATUS_REQUEST_STATUSES = [
  "submitted",
  "approved",
  "rejected",
  "revision_required",
] as const;

export type BusinessStatusRequestStatus = (typeof BUSINESS_STATUS_REQUEST_STATUSES)[number];

export const businessStatusRequests = pgTable(
  "business_status_requests",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    reason: text("reason").notNull(),
    linksJson: text("links_json").notNull().default("[]"),
    consentModeration: boolean("consent_moderation").notNull().default(true),
    status: varchar("status", { length: 32 }).notNull().default("submitted"),
    adminComment: text("admin_comment"),
    moderatedBy: varchar("moderated_by"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
    moderatedAt: timestamp("moderated_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [
    index("business_status_requests_user_created_idx").on(t.userId, t.createdAt),
    index("business_status_requests_status_created_idx").on(t.status, t.createdAt),
  ],
);

export type BusinessStatusRequest = typeof businessStatusRequests.$inferSelect;
export type InsertBusinessStatusRequest = typeof businessStatusRequests.$inferInsert;
