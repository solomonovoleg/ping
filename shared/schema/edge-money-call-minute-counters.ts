import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/** Накопленные полные минуты разговора (1:1) участника EDGE MONEY по паре диалог × кампания. */
export const edgeMoneyCallMinuteCounters = pgTable(
  "edge_money_call_minute_counters",
  {
    userId: varchar("user_id", { length: 128 }).notNull(),
    chatId: varchar("chat_id", { length: 128 }).notNull(),
    edgeId: varchar("edge_id", { length: 128 }).notNull(),
    minuteTotal: integer("minute_total").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("edge_money_call_minute_counters_user_chat_edge_uq").on(t.userId, t.chatId, t.edgeId)],
);

export type EdgeMoneyCallMinuteCounter = typeof edgeMoneyCallMinuteCounters.$inferSelect;
