import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Счётчик новых реакций на посты автора (чужие пользователи) для EDGE MONEY.
 * Одна реакция (user × post) даёт не более одного прироста — смена эмодзи не дублирует.
 */
export const edgeMoneyProfileLikeCounters = pgTable(
  "edge_money_profile_like_counters",
  {
    recipientUserId: varchar("recipient_user_id", { length: 128 }).notNull(),
    edgeId: varchar("edge_id", { length: 128 }).notNull(),
    receivedCount: integer("received_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("edge_money_profile_like_counters_recipient_edge_uq").on(t.recipientUserId, t.edgeId)],
);

export type EdgeMoneyProfileLikeCounter = typeof edgeMoneyProfileLikeCounters.$inferSelect;
