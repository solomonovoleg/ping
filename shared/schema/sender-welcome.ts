import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Настройки SENDER: приветствие новым подписчикам в ЛС. */
export const senderWelcomeSettings = pgTable("sender_welcome_settings", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Модуль «установлен» и доступен в Борде. */
  moduleEnabled: boolean("module_enabled").notNull().default(false),
  /** Автоотправка при новой подписке. */
  autoSendOnFollow: boolean("auto_send_on_follow").notNull().default(false),
  welcomeText: text("welcome_text").notNull().default(""),
  welcomeMediaUrl: text("welcome_media_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Успешные доставки приветствия (статистика + не больше одного раза на пару владелец—подписчик). */
export const senderWelcomeDeliveries = pgTable(
  "sender_welcome_deliveries",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followerUserId: varchar("follower_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sender_welcome_deliveries_owner_follower_uidx").on(t.ownerUserId, t.followerUserId)],
);

export type SenderWelcomeSettings = typeof senderWelcomeSettings.$inferSelect;
export type SenderWelcomeDelivery = typeof senderWelcomeDeliveries.$inferSelect;
