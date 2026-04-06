import { integer, pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/** Счётчик исходящих сообщений участника EDGE MONEY по паре (диалог × кампания). */
export const edgeMoneyChatMessageCounters = pgTable(
  "edge_money_chat_message_counters",
  {
    userId: varchar("user_id", { length: 128 }).notNull(),
    chatId: varchar("chat_id", { length: 128 }).notNull(),
    edgeId: varchar("edge_id", { length: 128 }).notNull(),
    sentCount: integer("sent_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("edge_money_chat_counters_user_chat_edge_uq").on(t.userId, t.chatId, t.edgeId)],
);

export type EdgeMoneyChatMessageCounter = typeof edgeMoneyChatMessageCounters.$inferSelect;
