import { boolean, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type PlatformSettingsRow = typeof platformSettings.$inferSelect;
