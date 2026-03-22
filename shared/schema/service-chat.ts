import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { messages } from "./messages";
import { users } from "./users";

export const serviceChatHosts = pgTable("service_chat_hosts", {
  hostUserId: varchar("host_user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  globalRepliesAllowed: boolean("global_replies_allowed").notNull().default(false),
  activatedAt: timestamp("activated_at", { withTimezone: true, mode: "date" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const serviceChatTemplates = pgTable("service_chat_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hostUserId: varchar("host_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const serviceChatTemplateSteps = pgTable("service_chat_template_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => serviceChatTemplates.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  content: text("content").notNull(),
  mediaJson: text("media_json"),
  delayAfterReadSec: integer("delay_after_read_sec").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const serviceChatThreads = pgTable(
  "service_chat_threads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    hostUserId: varchar("host_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    targetUserId: varchar("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    templateId: varchar("template_id").references(() => serviceChatTemplates.id, { onDelete: "set null" }),
    localRepliesEnabled: boolean("local_replies_enabled").notNull().default(false),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    hostTargetUnique: uniqueIndex("service_chat_threads_host_target_uq").on(t.hostUserId, t.targetUserId),
    chatUnique: uniqueIndex("service_chat_threads_chat_uq").on(t.chatId),
  }),
);

export const serviceChatStepStates = pgTable(
  "service_chat_step_states",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: varchar("thread_id").notNull().references(() => serviceChatThreads.id, { onDelete: "cascade" }),
    stepId: varchar("step_id").notNull().references(() => serviceChatTemplateSteps.id, { onDelete: "cascade" }),
    sentMessageId: varchar("sent_message_id").references(() => messages.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    nextSendAt: timestamp("next_send_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    threadStepUnique: uniqueIndex("service_chat_step_states_thread_step_uq").on(t.threadId, t.stepId),
  }),
);

export const serviceChatCampaigns = pgTable("service_chat_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  hostUserId: varchar("host_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").references(() => serviceChatTemplates.id, { onDelete: "set null" }),
  mode: text("mode").notNull(),
  filtersJson: text("filters_json"),
  status: text("status").notNull().default("created"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type ServiceChatHost = typeof serviceChatHosts.$inferSelect;
export type ServiceChatTemplate = typeof serviceChatTemplates.$inferSelect;
export type ServiceChatTemplateStep = typeof serviceChatTemplateSteps.$inferSelect;
export type ServiceChatThread = typeof serviceChatThreads.$inferSelect;
export type ServiceChatStepState = typeof serviceChatStepStates.$inferSelect;
export type ServiceChatCampaign = typeof serviceChatCampaigns.$inferSelect;
