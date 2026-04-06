import { boolean, integer, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Пользовательская полка в списке чатов (название задаёт пользователь). */
export const userChatListCustomFolder = pgTable("user_chat_list_custom_folder", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  pushMuted: boolean("push_muted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type UserChatListCustomFolder = typeof userChatListCustomFolder.$inferSelect;

/** Переименование и mute push для встроенных полок (general, friends, …). */
export const userChatListBuiltinTabPrefs = pgTable(
  "user_chat_list_builtin_tab_prefs",
  {
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tabId: varchar("tab_id", { length: 32 }).notNull(),
    labelOverride: text("label_override"),
    pushMuted: boolean("push_muted").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.tabId] })],
);

export type UserChatListBuiltinTabPrefs = typeof userChatListBuiltinTabPrefs.$inferSelect;
