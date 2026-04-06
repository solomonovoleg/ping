import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Тексты справочных страниц `/help/:slug` (редактируются в админке). */
export const helpPages = pgTable("help_pages", {
  id: varchar("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  title: text("title").notNull(),
  /** Текст с разметкой: абзацы через пустую строку, заголовки секций — строка `## Заголовок`. */
  body: text("body").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow(),
});

export type HelpPage = typeof helpPages.$inferSelect;
