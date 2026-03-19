import { sql } from "drizzle-orm";
import { date, integer, pgTable, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Максимальная длина имени и фамилии (символов) */
export const NAME_MAX_LENGTH = 12;

/** Пол: обязательное поле в профиле после регистрации */
export const GENDER_VALUES = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

/** Роль на платформе: для доступа в админку */
export const PLATFORM_ROLES = ["user", "moderator", "admin", "super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicId: integer("public_id").notNull().unique(),
  phone: text("phone").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  surname: text("surname"),
  /** Пол: обязателен в профиле */
  gender: varchar("gender", { length: 20 }),
  /** Дата рождения: по желанию */
  birthDate: date("birth_date", { mode: "string" }),
  avatarUrl: text("avatar_url"),
  /** Роль на платформе (доступ в админку) */
  platformRole: varchar("platform_role", { length: 20 }).notNull().default("user"),
  /** Заблокирован администратором */
  isBlocked: boolean("is_blocked").notNull().default(false),
  /** Когда заблокирован (для аудита) */
  bannedAt: timestamp("banned_at", { withTimezone: true, mode: "date" }),
  bannedBy: varchar("banned_by"),
  banReason: text("ban_reason"),
  /** Мягкое удаление (скрыть из списка) */
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  /** Скрыть профиль из глобального поиска; написать можно только по прямой ссылке и только если в контактах */
  hideFromSearch: boolean("hide_from_search").notNull().default(false),
  /** Кто пригласил (реферальная регистрация) */
  invitedById: text("invited_by_id"),
  /** Лимит приглашений (null = 3 по умолчанию). Админ может увеличить для отдельных пользователей. */
  referralLimit: integer("referral_limit"),
  /** Когда пользователь последний раз был в приложении (для статуса «в сети») */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }),
  /** FCM токен для пуш-уведомлений (Android / iOS через FCM) */
  fcmToken: text("fcm_token"),
  /** Включены ли пуш-уведомления о новых сообщениях и звонках */
  pushEnabled: boolean("push_enabled").notNull().default(true),
  /** Описание профиля (как в ВК/Instagram) */
  bio: text("bio"),
  /** URL шапки профиля (баннер сверху) */
  coverUrl: text("cover_url"),
  /** Показывать ли шапку (если загружена) */
  showCover: boolean("show_cover").notNull().default(true),
  /** Ссылка в профиле (блог, магазин и т.д.) */
  profileLink: text("profile_link"),
  /** Город / локация */
  city: text("city"),
  /** Статус / настроение (короткая строка) */
  status: text("status"),
  /** ID закреплённого поста в профиле (один на пользователя) */
  pinnedPostId: varchar("pinned_post_id"),
  /** Кто видит профиль: all | followers */
  profileVisibility: varchar("profile_visibility", { length: 20 }).notNull().default("all"),
  /** Показывать ли статус «в сети» всем или только подписчикам */
  showOnlineTo: varchar("show_online_to", { length: 20 }).notNull().default("all"),
  /** Атмосфера чата: включена ли адаптивная тема для DM */
  vibeEnabled: boolean("vibe_enabled").notNull().default(false),
  /** Делиться атмосферой с собеседником (если true — собеседник тоже видит вайб) */
  vibeShareWithPartner: boolean("vibe_share_with_partner").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  phone: true,
  password: true,
  publicId: true,
  invitedById: true,
});

export const updateProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  surname: true,
  gender: true,
  birthDate: true,
  avatarUrl: true,
  hideFromSearch: true,
  bio: true,
  coverUrl: true,
  showCover: true,
  profileLink: true,
  city: true,
  status: true,
  pinnedPostId: true,
  profileVisibility: true,
  showOnlineTo: true,
  pushEnabled: true,
  referralLimit: true,
  vibeEnabled: true,
  vibeShareWithPartner: true,
}).partial();

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
