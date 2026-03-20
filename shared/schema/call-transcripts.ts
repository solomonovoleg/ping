import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { chats } from "./chats";
import { tracks } from "./tracks";
import { users } from "./users";

export const callSessionsHistory = pgTable("call_sessions_history", {
  id: varchar("id").primaryKey(),
  chatId: varchar("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  mediaType: text("media_type", { enum: ["audio", "video"] }).notNull().default("audio"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
});

export const callParticipantsHistory = pgTable(
  "call_participants_history",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    callId: varchar("call_id").notNull().references(() => callSessionsHistory.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    displayNameSnapshot: text("display_name_snapshot").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("idx_call_participant_unique").on(t.callId, t.userId)],
);

export const callTranscriptSegments = pgTable("call_transcript_segments", {
  id: varchar("id").primaryKey(),
  callId: varchar("call_id").notNull().references(() => callSessionsHistory.id, { onDelete: "cascade" }),
  speakerUserId: varchar("speaker_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  speakerDisplayName: text("speaker_display_name").notNull(),
  sourceStreamId: varchar("source_stream_id"),
  language: varchar("language", { length: 24 }).notNull().default("ru-RU"),
  textRaw: text("text_raw").notNull(),
  textNormalized: text("text_normalized").notNull(),
  confidence: integer("confidence").notNull().default(0),
  startedAtMs: integer("started_at_ms").notNull().default(0),
  endedAtMs: integer("ended_at_ms").notNull().default(0),
  isFinal: boolean("is_final").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const callCommandSuggestions = pgTable(
  "call_command_suggestions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    callId: varchar("call_id").notNull().references(() => callSessionsHistory.id, { onDelete: "cascade" }),
    segmentId: varchar("segment_id").references(() => callTranscriptSegments.id, { onDelete: "cascade" }),
    intentType: text("intent_type").notNull(),
    title: text("title").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    status: text("status", { enum: ["pending", "accepted", "dismissed"] }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    resolvedByUserId: varchar("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("idx_call_command_unique_segment_intent").on(t.segmentId, t.intentType)],
);

export const callTrackItems = pgTable(
  "call_track_items",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    trackId: varchar("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
    callId: varchar("call_id").notNull().references(() => callSessionsHistory.id, { onDelete: "cascade" }),
    segmentId: varchar("segment_id").notNull().references(() => callTranscriptSegments.id, { onDelete: "cascade" }),
    speakerUserId: varchar("speaker_user_id").references(() => users.id, { onDelete: "set null" }),
    speakerDisplayName: text("speaker_display_name").notNull(),
    text: text("text").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [uniqueIndex("idx_call_track_items_track_segment").on(t.trackId, t.segmentId)],
);

export type CallSessionHistory = typeof callSessionsHistory.$inferSelect;
export type CallParticipantHistory = typeof callParticipantsHistory.$inferSelect;
export type CallTranscriptSegment = typeof callTranscriptSegments.$inferSelect;
export type CallCommandSuggestion = typeof callCommandSuggestions.$inferSelect;
export type CallTrackItem = typeof callTrackItems.$inferSelect;
