import { sql } from "drizzle-orm";
import { boolean, index, pgTable, primaryKey, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { posts } from "./posts";
import { users } from "./users";

export const PUSH_TTL_VALUES = ["12h", "24h", "48h", "56h", "forever"] as const;
export type PushTtlValue = (typeof PUSH_TTL_VALUES)[number];
export const PUSH_REPLY_VISIBILITY = ["public", "private"] as const;
export type PushReplyVisibility = (typeof PUSH_REPLY_VISIBILITY)[number];

/** Отдельная подписка на push-микропосты автора (не равна обычному follow). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    subscriberId: varchar("subscriber_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: varchar("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Скрывать все push этого автора из ленты (подписка сохраняется). */
    hidden: boolean("hidden").notNull().default(false),
    /** Только мобильные push-уведомления от этого автора (лента остается доступной). */
    notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.subscriberId, t.authorId),
    index("push_subscriptions_subscriber_created_idx").on(t.subscriberId, t.createdAt),
    index("push_subscriptions_author_created_idx").on(t.authorId, t.createdAt),
  ],
);

/** Публикация поста в push-ленту подписчиков автора. */
export const pushPosts = pgTable(
  "push_posts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: varchar("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: varchar("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ttl: varchar("ttl", { length: 16 }).notNull().default("24h"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.postId),
    index("push_posts_author_created_idx").on(t.authorId, t.createdAt),
    index("push_posts_expires_idx").on(t.expiresAt),
  ],
);

/** Уникальные просмотры push (один пользователь — одна строка на push_post). */
export const pushPostViews = pgTable(
  "push_post_views",
  {
    pushPostId: varchar("push_post_id")
      .notNull()
      .references(() => pushPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.pushPostId, t.userId] }),
    index("push_post_views_post_idx").on(t.pushPostId),
  ],
);

/** Скрытые пользователем единицы push-ленты (удаление карточки без удаления исходного поста). */
export const pushHiddenItems = pgTable(
  "push_hidden_items",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pushPostId: varchar("push_post_id")
      .notNull()
      .references(() => pushPosts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.pushPostId), index("push_hidden_items_user_created_idx").on(t.userId, t.createdAt)],
);

/** Реакции на push (не на пост). */
export const pushReactions = pgTable(
  "push_reactions",
  {
    pushPostId: varchar("push_post_id")
      .notNull()
      .references(() => pushPosts.id, { onDelete: "cascade" }),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: varchar("emoji", { length: 24 }).notNull().default("❤️"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.pushPostId, t.userId), index("push_reactions_post_created_idx").on(t.pushPostId, t.createdAt)],
);

/** Ответы на push внутри push-ленты (отдельно от комментариев поста). */
export const pushReplies = pgTable(
  "push_replies",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    pushPostId: varchar("push_post_id")
      .notNull()
      .references(() => pushPosts.id, { onDelete: "cascade" }),
    postId: varchar("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: varchar("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    pushAuthorId: varchar("push_author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    visibility: varchar("visibility", { length: 16 }).notNull().default("public"),
    text: varchar("text", { length: 8000 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("push_replies_post_created_idx").on(t.pushPostId, t.createdAt),
    index("push_replies_author_created_idx").on(t.authorId, t.createdAt),
  ],
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;
export type PushPost = typeof pushPosts.$inferSelect;
export type InsertPushPost = typeof pushPosts.$inferInsert;
export type PushHiddenItem = typeof pushHiddenItems.$inferSelect;
export type InsertPushHiddenItem = typeof pushHiddenItems.$inferInsert;
export type PushReaction = typeof pushReactions.$inferSelect;
export type InsertPushReaction = typeof pushReactions.$inferInsert;
export type PushReply = typeof pushReplies.$inferSelect;
export type InsertPushReply = typeof pushReplies.$inferInsert;
export type PushPostView = typeof pushPostViews.$inferSelect;
export type InsertPushPostView = typeof pushPostViews.$inferInsert;
