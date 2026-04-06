import { sql } from "drizzle-orm";
import { date, integer, pgTable, text, timestamp, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** Максимальная длина имени и фамилии (символов) */
export const NAME_MAX_LENGTH = 12;

/** Максимальная длина строки города в профиле (подсказка + ручной ввод) */
export const PROFILE_CITY_MAX_LENGTH = 120;

/** Никнейм в плашке шапки профиля (@handle), без пробелов */
export const NICKNAME_MAX_LENGTH = 24;

/** Пол: обязательное поле в профиле после регистрации */
export const GENDER_VALUES = ["male", "female", "other"] as const;
export type Gender = (typeof GENDER_VALUES)[number];

/** Роль на платформе: для доступа в админку */
export const PLATFORM_ROLES = ["user", "moderator", "admin", "super_admin"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const BUSINESS_STATUS_VALUES = [
  "none",
  "pending",
  "approved",
  "rejected",
  "revision_required",
] as const;
export type BusinessStatus = (typeof BUSINESS_STATUS_VALUES)[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  publicId: integer("public_id").notNull().unique(),
  /** Устаревшее хранение в открытом виде; при PHONE_AT_REST_SECRET — null, см. phone_cipher + phone_lookup_hash */
  phone: text("phone"),
  /** HMAC-SHA256 по нормализованному номеру — только для точного поиска / логина / match-phones */
  phoneLookupHash: varchar("phone_lookup_hash", { length: 64 }),
  /** AES-256-GCM, не отдаётся в API */
  phoneCipher: text("phone_cipher"),
  password: text("password").notNull(),
  displayName: text("display_name"),
  surname: text("surname"),
  /** Публичный ник в шапке профиля (плашка с @); не уникален в БД */
  nickname: text("nickname"),
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
  /** iOS PushKit VoIP token (hex) для APNs voip — системный экран входящего (CallKit) */
  iosVoipToken: text("ios_voip_token"),
  /** Включены ли пуш-уведомления о новых сообщениях и звонках */
  pushEnabled: boolean("push_enabled").notNull().default(true),
  /**
   * Мобильные push модуля Push: микропосты в подписках, ответы на ваши Push, новые подписчики на ваши Push.
   * Лента в чатах и in-app уведомления (колокольчик) зависят от других настроек / всегда доступны как события.
   */
  pushFeedNotificationsEnabled: boolean("push_feed_notifications_enabled").notNull().default(true),
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
  /** Кто может писать вам в личку (новый диалог): all | followers | mutual */
  dmPolicy: varchar("dm_policy", { length: 20 }).notNull().default("all"),
  /** Кто может добавлять вас в группы: all | followers | mutual (followers = вы подписаны на инициатора) */
  groupAddMePolicy: varchar("group_add_me_policy", { length: 20 }).notNull().default("all"),
  /** Показывать ли статус «в сети» всем или только подписчикам */
  showOnlineTo: varchar("show_online_to", { length: 20 }).notNull().default("all"),
  /** Атмосфера чата: включена ли адаптивная тема для DM */
  vibeEnabled: boolean("vibe_enabled").notNull().default(false),
  /** Делиться атмосферой с собеседником (если true — собеседник тоже видит вайб) */
  vibeShareWithPartner: boolean("vibe_share_with_partner").notNull().default(false),
  /**
   * PRIME CODE (API HUB): непустая строка — доступ к разделу API HUB на Борде.
   * Задаётся только из админки; клиенту в /auth/me отдаётся только флаг `boardApiHubAccess`.
   */
  boardApiHubPrimeCode: varchar("board_api_hub_prime_code", { length: 64 }),
  /** Бизнес-статус аккаунта (модерируется через заявки). */
  businessStatus: varchar("business_status", { length: 32 }).notNull().default("none"),
  businessStatusUpdatedAt: timestamp("business_status_updated_at", { withTimezone: true, mode: "date" }),
  businessStatusUpdatedBy: varchar("business_status_updated_by"),
  /** Контактный телефон бизнеса (публичный), показывается только для approved бизнес-профиля. */
  businessContactPhone: varchar("business_contact_phone", { length: 64 }),
  /** Контактный адрес бизнеса (публичный), показывается только для approved бизнес-профиля. */
  businessAddress: text("business_address"),
  /** Клиентский IP на момент регистрации (за прокси — см. trust proxy) */
  signupIp: varchar("signup_ip", { length: 64 }),
  /** Сырой X-Forwarded-For (цепочка прокси), усечённый */
  signupForwardedFor: text("signup_forwarded_for"),
  signupUserAgent: text("signup_user_agent"),
  /** SHA-256 от User-Agent для группировки без хранения полной строки отдельно (UA всё же храним усечённым для админки) */
  signupUaHash: varchar("signup_ua_hash", { length: 64 }),
  signupAcceptLanguage: varchar("signup_accept_language", { length: 256 }),
  /** Язык входящих сообщений (перевод в чате); синхронизируется с клиентом, BCP-47 короткий код. */
  messageTranslateLocale: varchar("message_translate_locale", { length: 10 }),
  signupSecChUa: text("signup_sec_ch_ua"),
  signupSecChUaMobile: varchar("signup_sec_ch_ua_mobile", { length: 32 }),
  signupSecChUaPlatform: varchar("signup_sec_ch_ua_platform", { length: 256 }),
  signupReferer: text("signup_referer"),
  signupOrigin: varchar("signup_origin", { length: 256 }),
  /**
   * Пользователь создан в админке (медиа-студия): не логинится по телефону, маркер для аудита и политик.
   */
  isStudioSynthetic: boolean("is_studio_synthetic").notNull().default(false),
  /** Какой админ создал studio user (users.id); ON DELETE SET NULL в БД */
  studioCreatedByAdminId: varchar("studio_created_by_admin_id"),
  /** Стабильный ID браузера/приложения (first-party cookie + тело запроса) */
  signupDeviceId: varchar("signup_device_id", { length: 128 }),
  /** SHA-256 от нормализованного JSON clientSignals с клиента */
  signupClientSignalsHash: varchar("signup_client_signals_hash", { length: 64 }),
  /** Усечённый JSON сигналов с клиента (таймзона, экран и т.д.) для просмотра в админке */
  signupClientSignalsJson: text("signup_client_signals_json"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  phone: true,
  phoneLookupHash: true,
  phoneCipher: true,
  password: true,
  publicId: true,
  invitedById: true,
  signupIp: true,
  signupForwardedFor: true,
  signupUserAgent: true,
  signupUaHash: true,
  signupAcceptLanguage: true,
  signupSecChUa: true,
  signupSecChUaMobile: true,
  signupSecChUaPlatform: true,
  signupReferer: true,
  signupOrigin: true,
  signupDeviceId: true,
  signupClientSignalsHash: true,
  signupClientSignalsJson: true,
});

/** Регистрация: либо plaintext phone (dev / без секрета), либо пара hash+cipher (прод с PHONE_AT_REST_SECRET). */
export type InsertUser = {
  password: string;
  publicId: number;
  invitedById?: string | null;
  phone?: string | null;
  phoneLookupHash?: string | null;
  phoneCipher?: string | null;
  signupIp?: string | null;
  signupForwardedFor?: string | null;
  signupUserAgent?: string | null;
  signupUaHash?: string | null;
  signupAcceptLanguage?: string | null;
  signupSecChUa?: string | null;
  signupSecChUaMobile?: string | null;
  signupSecChUaPlatform?: string | null;
  signupReferer?: string | null;
  signupOrigin?: string | null;
  signupDeviceId?: string | null;
  signupClientSignalsHash?: string | null;
  signupClientSignalsJson?: string | null;
};

export const updateProfileSchema = createInsertSchema(users).pick({
  displayName: true,
  surname: true,
  nickname: true,
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
  dmPolicy: true,
  groupAddMePolicy: true,
  showOnlineTo: true,
  pushEnabled: true,
  referralLimit: true,
  vibeEnabled: true,
  vibeShareWithPartner: true,
  boardApiHubPrimeCode: true,
  businessContactPhone: true,
  businessAddress: true,
}).partial();

export type User = typeof users.$inferSelect;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
