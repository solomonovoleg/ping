import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Одна строка: глобальный баннер и флаги (id = default) */
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default("default"),
  bannerEnabled: boolean("banner_enabled").notNull().default(false),
  bannerText: text("banner_text").notNull().default(""),
  /** info | warning | danger */
  bannerVariant: varchar("banner_variant", { length: 16 }).notNull().default("info"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  /** Ужесточить лимиты API для неавторизованных (боты / флуд), авторизованные — с запасом */
  strictApiShield: boolean("strict_api_shield").notNull().default(false),
  /**
   * Регистрация: требовать звонок New-Tel, если он настроен на сервере (ключи в окружении).
   */
  registrationPhoneCallVerificationEnabled: boolean("registration_phone_call_verification_enabled")
    .notNull()
    .default(true),
  /** Рефералка: стартовое число приглашений на пользователя. */
  referralDefaultInvites: integer("referral_default_invites").notNull().default(3),
  /** Рефералка: авто-довыдача после исчерпания стартового лимита. */
  referralRepeatEnabled: boolean("referral_repeat_enabled").notNull().default(false),
  /** Рефералка: сколько приглашений добавить при авто-довыдаче. */
  referralRepeatInvites: integer("referral_repeat_invites").notNull().default(5),
  /** Рефералка: через сколько часов после исчерпания стартового лимита добавить бонус. */
  referralRepeatAfterHours: integer("referral_repeat_after_hours").notNull().default(72),
  /** По умолчанию TTL многоразового системного/админского кода. */
  referralMultiUseDefaultExpiresHours: integer("referral_multi_use_default_expires_hours").notNull().default(168),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
