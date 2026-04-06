import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/** Журнал HTTP-запросов к New-Tel CallPassword (регистрация / сброс пароля по звонку). */
export const newTelCallPasswordLog = pgTable("new_tel_call_password_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  scenario: varchar("scenario", { length: 32 }).notNull(),
  apiMethod: text("api_method").notNull(),
  durationMs: integer("duration_ms").notNull(),
  httpStatus: integer("http_status"),
  apiOk: boolean("api_ok"),
  errorMessage: text("error_message"),
  requestRedacted: jsonb("request_redacted"),
  responseSanitized: jsonb("response_sanitized"),
  /** Разбор исход/исхода, коды New-Tel, внутренние коды подтверждения */
  detail: jsonb("detail"),
});

export type NewTelCallPasswordLogRow = typeof newTelCallPasswordLog.$inferSelect;
