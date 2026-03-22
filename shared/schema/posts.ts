import { sql } from "drizzle-orm";
import { boolean, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { PostMediaLayout } from "../post-media-layout";

/** Извлечь уникальные хештеги из текста (#слово) в нижнем регистре */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Zа-яёА-ЯЁ0-9_]+/g) ?? [];
  const set = new Set<string>();
  matches.forEach((m) => set.add(m.slice(1).toLowerCase()));
  return Array.from(set);
}

/** Максимум разных @упоминаний в одном посте (уникальные токены после extractMentions). */
export const MAX_POST_MENTIONS = 5;

/**
 * Извлечь упоминания для уведомлений: плоские @token и разметка @[имя](публичныйId) как в чате.
 * Возвращаемые строки — без @ (число = public id, иначе имя для resolve).
 */
export function extractMentions(text: string): string[] {
  const set = new Set<string>();
  const md = text.matchAll(/@\[([^\]]*)]\((\d+)\)/g);
  for (const m of md) {
    const id = m[2]?.trim();
    if (id) set.add(id);
  }
  const plain = text.match(/@[a-zA-Zа-яёА-ЯЁ0-9_]+/g) ?? [];
  plain.forEach((m) => set.add(m.slice(1)));
  return Array.from(set);
}

export const POST_VISIBILITY = ["public", "followers"] as const;
export type PostVisibility = (typeof POST_VISIBILITY)[number];

/** Посты в ленте (автор = пользователь) */
export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  /** Одно фото/видео (для обратной совместимости); при наличии mediaUrls используется первый элемент для превью */
  imageUrl: text("image_url"),
  /** Несколько фото/видео в посте (как во ВКонтакте). URL строки. */
  mediaUrls: jsonb("media_urls").$type<string[]>(),
  /** Зафиксированный формат отображения медиа (single/collage), чтобы у всех клиентов был одинаковый layout. */
  mediaLayout: jsonb("media_layout").$type<PostMediaLayout | null>(),
  /** Реакции в виде [{ emoji: "❤️", count: 5 }, ...] для отображения без отдельной таблицы */
  reactions: jsonb("reactions").$type<{ emoji: string; count: number }[]>().default([]),
  /** Хештеги, извлечённые из text (#слово), для поиска */
  hashtags: jsonb("hashtags").$type<string[]>(),
  /** Черновик не показывается в ленте */
  isDraft: boolean("is_draft").notNull().default(false),
  /** Кто видит пост: public | followers */
  visibility: varchar("visibility", { length: 20 }).notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;
