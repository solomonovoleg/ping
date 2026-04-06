import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/** Счётчик опубликованных постов автора для EDGE MONEY (порог по кампании). */
export const edgeMoneyPostCounters = pgTable(
  "edge_money_post_counters",
  {
    userId: varchar("user_id", { length: 128 }).notNull(),
    edgeId: varchar("edge_id", { length: 128 }).notNull(),
    postCount: integer("post_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("edge_money_post_counters_user_edge_uq").on(t.userId, t.edgeId)],
);

export type EdgeMoneyPostCounter = typeof edgeMoneyPostCounters.$inferSelect;
