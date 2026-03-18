import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Пригласительные коды: читаемый код из 4 слов, срок действия 12 часов, одноразовый */
export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey(),
  /** Человекочитаемый код: 4 слова через дефис, например sun-sea-coffee-book */
  code: text("code").notNull().unique(),
  /** Кто создал приглашение */
  inviterUserId: text("inviter_user_id").notNull(),
  /** До какого момента код действителен */
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  /** Когда код использован (null = ещё не использован) */
  usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;
