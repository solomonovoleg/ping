import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { users } from "./users";

export const businessWidgets = pgTable(
  "business_widgets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    providerType: text("provider_type").notNull().default("custom"),
    endpointUrl: text("endpoint_url").notNull(),
    contractUrl: text("contract_url"),
    apiKeyEnc: text("api_key_enc").notNull(),
    status: text("status").notNull().default("active"),
    lastAutoconfigAt: timestamp("last_autoconfig_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    chatUnique: uniqueIndex("business_widgets_chat_uq").on(t.chatId),
    ownerNameUnique: uniqueIndex("business_widgets_owner_name_uq").on(t.ownerUserId, t.name),
  }),
);

export const businessContracts = pgTable(
  "business_contracts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    widgetId: varchar("widget_id").notNull().references(() => businessWidgets.id, { onDelete: "cascade" }),
    rawJson: text("raw_json").notNull(),
    normalizedDslJson: text("normalized_dsl_json").notNull(),
    uiBlueprintJson: text("ui_blueprint_json").notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    widgetVersionUnique: uniqueIndex("business_contracts_widget_version_uq").on(t.widgetId, t.version),
  }),
);

export const businessActions = pgTable(
  "business_actions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    widgetId: varchar("widget_id").notNull().references(() => businessWidgets.id, { onDelete: "cascade" }),
    actionId: text("action_id").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull().default("button"),
    requestMethod: text("request_method").notNull().default("POST"),
    requestPath: text("request_path"),
    inputSchemaJson: text("input_schema_json"),
    payloadJson: text("payload_json"),
    orderIndex: integer("order_index").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    widgetActionUnique: uniqueIndex("business_actions_widget_action_uq").on(t.widgetId, t.actionId),
  }),
);

export const businessEvents = pgTable(
  "business_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    widgetId: varchar("widget_id").notNull().references(() => businessWidgets.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    eventType: text("event_type").notNull(),
    status: text("status").notNull().default("pending"),
    idempotencyKey: text("idempotency_key"),
    externalEventId: text("external_event_id"),
    payloadJson: text("payload_json").notNull(),
    responseJson: text("response_json"),
    attemptCount: integer("attempt_count").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "date" }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    widgetExternalUnique: uniqueIndex("business_events_widget_external_uq").on(t.widgetId, t.direction, t.externalEventId),
  }),
);

export type BusinessWidget = typeof businessWidgets.$inferSelect;
export type BusinessContract = typeof businessContracts.$inferSelect;
export type BusinessAction = typeof businessActions.$inferSelect;
export type BusinessEvent = typeof businessEvents.$inferSelect;
