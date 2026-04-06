import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Пригласительные коды: обычно 4 цифры; старые записи могли быть фразой через дефис. 1 = одноразовый, -1 = без лимита до истечения */
export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey(),
  /** Код приглашения (новые — 4 цифры; ранее — фраза через дефис) */
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
  /** Заметка админа при создании кода (не показывается при регистрации). */
  adminNote: text("admin_note"),
  /** Партия EDGE MONEY (тройка кодов); null — обычный рефкод. */
  edgeMoneyInviteBatchId: varchar("edge_money_invite_batch_id"),
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type InsertReferralCode = typeof referralCodes.$inferInsert;

/** Заявка пользователя на увеличение лимита приглашений (модерация в админке). */
export const inviteMoreRequests = pgTable("invite_more_requests", {
  id: varchar("id").primaryKey(),
  userId: text("user_id").notNull(),
  message: text("message"),
  status: varchar("status", { length: 16 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewedByUserId: text("reviewed_by_user_id"),
  /** Сколько слотов к лимиту добавить при одобрении (по умолчанию 3). */
  bonusInvites: integer("bonus_invites").notNull().default(3),
});

export type InviteMoreRequest = typeof inviteMoreRequests.$inferSelect;

/** Состояние авто-довыдачи приглашений после исчерпания стартового лимита. */
export const referralAutoGrants = pgTable("referral_auto_grants", {
  userId: text("user_id").primaryKey(),
  firstLimitReachedAt: timestamp("first_limit_reached_at", { withTimezone: true, mode: "date" }),
  bonusGrantedAt: timestamp("bonus_granted_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type ReferralAutoGrant = typeof referralAutoGrants.$inferSelect;
