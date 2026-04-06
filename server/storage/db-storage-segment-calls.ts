/** Сегмент `DbStorage`: история звонков, транскрипт, подсказки команд. */
import { callSessionsHistory } from "@shared/schema";
import type { CallTranscriptSegment } from "@shared/schema";
import type { CallTranscriptSegmentUpsertInput } from "./db-storage-call-transcript-segment-payload";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageCreateCallCommandSuggestion,
  dbStorageCreateCallSessionHistory,
  dbStorageEndCallSessionHistory,
  dbStorageGetCallTranscriptSegment,
  dbStorageListCallCommandSuggestions,
  dbStorageListCallSessionsHistory,
  dbStorageListCallTranscriptSegments,
  dbStorageMarkCallParticipantLeft,
  dbStorageResolveCallCommandSuggestion,
  dbStorageUpsertCallParticipantHistory,
  dbStorageUpsertCallTranscriptSegment,
} from "./db-storage-facade-queries";

export const dbStorageSegmentCalls = {
  createCallSessionHistory(
    host: DbStorageSegmentHost,
    data: { id: string; chatId: string; mediaType: "audio" | "video"; createdByUserId: string },
  ) {
    return dbStorageCreateCallSessionHistory(host.db, data);
  },

  endCallSessionHistory(host: DbStorageSegmentHost, callId: string): Promise<void> {
    return dbStorageEndCallSessionHistory(host.db, callId);
  },

  upsertCallParticipantHistory(
    host: DbStorageSegmentHost,
    callId: string,
    userId: string,
    displayNameSnapshot: string,
  ) {
    return dbStorageUpsertCallParticipantHistory(host.db, callId, userId, displayNameSnapshot);
  },

  markCallParticipantLeft(host: DbStorageSegmentHost, callId: string, userId: string): Promise<void> {
    return dbStorageMarkCallParticipantLeft(host.db, callId, userId);
  },

  upsertCallTranscriptSegment(
    host: DbStorageSegmentHost,
    data: CallTranscriptSegmentUpsertInput,
  ): Promise<CallTranscriptSegment> {
    return dbStorageUpsertCallTranscriptSegment(host.db, data);
  },

  getCallTranscriptSegment(
    host: DbStorageSegmentHost,
    callId: string,
    segmentId: string,
  ): Promise<CallTranscriptSegment | undefined> {
    return dbStorageGetCallTranscriptSegment(host.db, callId, segmentId);
  },

  listCallTranscriptSegments(host: DbStorageSegmentHost, userId: string, callId: string): Promise<CallTranscriptSegment[]> {
    return dbStorageListCallTranscriptSegments(host.db, userId, callId);
  },

  listCallSessionsHistory(
    host: DbStorageSegmentHost,
    userId: string,
  ): Promise<Array<typeof callSessionsHistory.$inferSelect & { participantCount: number; chatName: string }>> {
    return dbStorageListCallSessionsHistory(host.db, userId, host.facadeCallbacks.getChatById);
  },

  createCallCommandSuggestion(
    host: DbStorageSegmentHost,
    data: { callId: string; segmentId?: string | null; intentType: string; title: string; payloadJson: string },
  ) {
    return dbStorageCreateCallCommandSuggestion(host.db, data);
  },

  listCallCommandSuggestions(host: DbStorageSegmentHost, userId: string, callId: string) {
    return dbStorageListCallCommandSuggestions(host.db, userId, callId);
  },

  resolveCallCommandSuggestion(
    host: DbStorageSegmentHost,
    userId: string,
    callId: string,
    suggestionId: string,
    status: "accepted" | "dismissed",
  ): Promise<void> {
    return dbStorageResolveCallCommandSuggestion(host.db, userId, callId, suggestionId, status);
  },
};
