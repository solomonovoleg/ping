import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Сториз пользователя (медиа + превью) */
export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  /** Текст поверх сторис; поддерживаются @упоминания как в постах (@[Имя](publicId)). */
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  /** Когда сториз перестаёт быть активным (для 24/46/56 часов). */
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`(now() + interval '24 hours')`),
  /** Буст от лайка (короткое окно). */
  feedBoostLikeAt: timestamp("feed_boost_like_at", { withTimezone: true, mode: "date" }),
  /** Буст от ответа на сториз в чате (длиннее). */
  feedBoostReplyAt: timestamp("feed_boost_reply_at", { withTimezone: true, mode: "date" }),
});

export type Story = typeof stories.$inferSelect;
export type InsertStory = typeof stories.$inferInsert;
