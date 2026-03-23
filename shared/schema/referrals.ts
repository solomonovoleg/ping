import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Пригласительные коды: читаемый код из 4 слов, срок действия; 1 = одноразовый, -1 = без лимита до истечения */
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
  /** 1 — одноразовый; >1 — не более N регистраций; -1 — без лимита до expires_at */
  maxUses: integer("max_uses").notNull().default(1),
  /** Сколько раз код уже применили при регистрации */
  useCount: integer("use_count").notNull().default(0),
  /** true — при регистрации не проверять лимит приглашений у inviter (кампания EDGE). */
  bypassInviterLimit: boolean("bypass_inviter_limit").notNull().default(false),
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;
