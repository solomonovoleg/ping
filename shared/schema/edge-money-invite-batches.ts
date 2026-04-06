import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Партия кодов приглашения под кампанию EDGE MONEY (обычно 3 слота). */
export const edgeMoneyInviteBatches = pgTable("edge_money_invite_batches", {
  id: varchar("id").primaryKey(),
  inviterUserId: text("inviter_user_id").notNull(),
  edgeId: text("edge_id").notNull(),
  batchIndex: integer("batch_index").notNull(),
  slotCount: integer("slot_count").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type EdgeMoneyInviteBatch = typeof edgeMoneyInviteBatches.$inferSelect;
export type InsertEdgeMoneyInviteBatch = typeof edgeMoneyInviteBatches.$inferInsert;
