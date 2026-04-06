/** Сегмент `DbStorage`: vibe, напоминания, голосовые задачи, Pingok, DM-call. */
import type {
  Chat,
  ChatVibeBatch,
  ChatVibeHistoryEntry,
  ChatVibeState,
  UserReminder,
  VoiceTask,
} from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageCancelDmScheduledCallAsPlanner,
  dbStorageCompleteVoiceTask,
  dbStorageCreateDmScheduledCall,
  dbStorageCreateUserReminder,
  dbStorageCreateVibeBatch,
  dbStorageCreateVibeHistoryEntry,
  dbStorageCreateVoiceTask,
  dbStorageDismissDmScheduledCallForChatMember,
  dbStorageDismissUserReminder,
  dbStorageEnsurePingokTrackSourceChat,
  dbStorageGetActiveDmScheduledCallForChatMember,
  dbStorageGetRecentVibeBatches,
  dbStorageGetVibeState,
  dbStorageListDmScheduledCallsInPreEventWindow,
  dbStorageListDueUserReminders,
  dbStorageListOpenVoiceTasks,
  dbStorageListPlannerActiveDmScheduledCalls,
  dbStorageUpdateDmScheduledCallFireAsPlanner,
  dbStorageUpdateUserReminderFireAt,
  dbStorageUpsertVibeState,
} from "./db-storage-facade-queries";

export const dbStorageSegmentPlanner = {
  getVibeState(host: DbStorageSegmentHost, chatId: string): Promise<ChatVibeState | undefined> {
    return dbStorageGetVibeState(host.db, chatId);
  },

  upsertVibeState(
    host: DbStorageSegmentHost,
    chatId: string,
    data: {
      theme: VibeThemeCode;
      confidence: number;
      axes: VibeAxes;
      messageCounter: number;
      themeVersion?: number;
      touchLastBatchAt?: boolean;
    },
  ): Promise<ChatVibeState> {
    return dbStorageUpsertVibeState(host.db, chatId, data);
  },

  createVibeBatch(
    host: DbStorageSegmentHost,
    data: {
      chatId: string;
      windowSize: number;
      dominantPattern: VibeThemeCode;
      secondaryPattern?: VibeThemeCode;
      confidence: number;
      axes: VibeAxes;
      toxicityFlag?: boolean;
    },
  ): Promise<ChatVibeBatch> {
    return dbStorageCreateVibeBatch(host.db, data);
  },

  getRecentVibeBatches(host: DbStorageSegmentHost, chatId: string, limit: number): Promise<ChatVibeBatch[]> {
    return dbStorageGetRecentVibeBatches(host.db, chatId, limit);
  },

  createVibeHistoryEntry(
    host: DbStorageSegmentHost,
    data: {
      chatId: string;
      oldTheme: string;
      newTheme: string;
      oldConfidence: number;
      newConfidence: number;
      triggerType: string;
    },
  ): Promise<ChatVibeHistoryEntry> {
    return dbStorageCreateVibeHistoryEntry(host.db, data);
  },

  createUserReminder(host: DbStorageSegmentHost, data: { userId: string; title: string; fireAt: Date }): Promise<UserReminder> {
    return dbStorageCreateUserReminder(host.db, data);
  },

  listDueUserReminders(host: DbStorageSegmentHost, userId: string, before: Date): Promise<UserReminder[]> {
    return dbStorageListDueUserReminders(host.db, userId, before);
  },

  dismissUserReminder(host: DbStorageSegmentHost, userId: string, id: string): Promise<boolean> {
    return dbStorageDismissUserReminder(host.db, userId, id);
  },

  updateUserReminderFireAt(host: DbStorageSegmentHost, userId: string, id: string, fireAt: Date): Promise<boolean> {
    return dbStorageUpdateUserReminderFireAt(host.db, userId, id, fireAt);
  },

  createVoiceTask(host: DbStorageSegmentHost, data: { userId: string; title: string }): Promise<VoiceTask> {
    return dbStorageCreateVoiceTask(host.db, data);
  },

  listOpenVoiceTasks(host: DbStorageSegmentHost, userId: string, limit: number): Promise<VoiceTask[]> {
    return dbStorageListOpenVoiceTasks(host.db, userId, limit);
  },

  completeVoiceTask(host: DbStorageSegmentHost, userId: string, id: string): Promise<boolean> {
    return dbStorageCompleteVoiceTask(host.db, userId, id);
  },

  ensurePingokTrackSourceChat(host: DbStorageSegmentHost, userId: string): Promise<Chat> {
    return dbStorageEnsurePingokTrackSourceChat(host.pool, userId, {
      upsertChatMemberPrefs: host.facadeCallbacks.upsertChatMemberPrefs,
      getChatById: host.facadeCallbacks.getChatById,
    });
  },

  createDmScheduledCall(
    host: DbStorageSegmentHost,
    data: {
      chatId: string;
      createdByUserId: string;
      peerUserId: string;
      fireAt: Date;
      title: string;
      plannerReminderId?: string | null;
    },
  ): Promise<{ id: string }> {
    return dbStorageCreateDmScheduledCall(host.db, data);
  },

  getActiveDmScheduledCallForChatMember(
    host: DbStorageSegmentHost,
    userId: string,
    chatId: string,
  ): Promise<{
    id: string;
    fireAt: Date;
    title: string;
    createdByUserId: string;
    peerUserId: string;
    iAmInitiator: boolean;
  } | null> {
    return dbStorageGetActiveDmScheduledCallForChatMember(
      host.db,
      userId,
      chatId,
      host.facadeCallbacks.getChatMemberIds,
    );
  },

  dismissDmScheduledCallForChatMember(
    host: DbStorageSegmentHost,
    userId: string,
    chatId: string,
    rowId: string,
    options: { forBoth: boolean },
  ): Promise<boolean> {
    return dbStorageDismissDmScheduledCallForChatMember(
      host.db,
      userId,
      chatId,
      rowId,
      options,
      host.facadeCallbacks.getChatMemberIds,
    );
  },

  listPlannerActiveDmScheduledCalls(host: DbStorageSegmentHost, userId: string): Promise<
    Array<{
      id: string;
      chatId: string;
      peerUserId: string;
      fireAt: Date;
      title: string;
      plannerReminderId: string | null;
    }>
  > {
    return dbStorageListPlannerActiveDmScheduledCalls(host.db, userId);
  },

  updateDmScheduledCallFireAsPlanner(
    host: DbStorageSegmentHost,
    userId: string,
    rowId: string,
    fireAt: Date,
    title: string,
  ): Promise<{ chatId: string; peerUserId: string } | null> {
    return dbStorageUpdateDmScheduledCallFireAsPlanner(
      host.db,
      userId,
      rowId,
      fireAt,
      title,
      host.facadeCallbacks.updateUserReminderFireAt,
    );
  },

  cancelDmScheduledCallAsPlanner(
    host: DbStorageSegmentHost,
    userId: string,
    rowId: string,
  ): Promise<{ chatId: string; peerUserId: string } | null> {
    return dbStorageCancelDmScheduledCallAsPlanner(host.db, userId, rowId, host.facadeCallbacks.dismissUserReminder);
  },

  listDmScheduledCallsInPreEventWindow(
    host: DbStorageSegmentHost,
    userId: string,
  ): Promise<Array<{ id: string; chatId: string; title: string; fireAt: Date }>> {
    return dbStorageListDmScheduledCallsInPreEventWindow(host.db, userId);
  },
};
