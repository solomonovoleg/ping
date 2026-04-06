import { sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { messages } from "./messages";
import { users } from "./users";

/** Идемпотентная отправка сообщения (повтор POST с тем же ключом — тот же message id). */
export const messageSendIdempotency = pgTable(
  "message_send_idempotency",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()::text`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("message_send_idem_user_chat_key_uq").on(t.userId, t.chatId, t.idempotencyKey)],
);
