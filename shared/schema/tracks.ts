import { pgTable, text, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { messages } from "./messages";
import { chats } from "./chats";

/** Трек — пользовательский список для сбора сообщений из чатов (задачи, заметки и т.п.) */
export const tracks = pgTable("tracks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

/** Элемент трека — сообщение, добавленное в трек. Хронология по addedAt. */
export const trackItems = pgTable(
  "track_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    trackId: varchar("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    /** Выполнено ли (отмечено пользователем) */
    doneAt: timestamp("done_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("idx_track_items_track_message").on(t.trackId, t.messageId)]
);

export type Track = typeof tracks.$inferSelect;
export type InsertTrack = typeof tracks.$inferInsert;
export type TrackItem = typeof trackItems.$inferSelect;
export type InsertTrackItem = typeof trackItems.$inferInsert;
