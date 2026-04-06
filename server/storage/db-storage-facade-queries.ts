/**
 * Единая точка реэкспорта функций слоя запросов для `DbStorage`.
 * Домены сгруппированы по зонам продукта; внутри каждого `export { … }` имена в алфавитном порядке.
 * Реализация остаётся в узких модулях `db-storage-*-queries.ts`.
 */

// ── Planner / vibe / Pingok ───────────────────────────────────
export {
  dbStorageCancelDmScheduledCallAsPlanner,
  dbStorageCreateDmScheduledCall,
  dbStorageDismissDmScheduledCallForChatMember,
  dbStorageGetActiveDmScheduledCallForChatMember,
  dbStorageListDmScheduledCallsInPreEventWindow,
  dbStorageListPlannerActiveDmScheduledCalls,
  dbStorageUpdateDmScheduledCallFireAsPlanner,
} from "./db-storage-dm-scheduled-call-queries";
export { dbStorageEnsurePingokTrackSourceChat } from "./db-storage-pingok-track-source-queries";
export {
  dbStorageCreateVibeBatch,
  dbStorageCreateVibeHistoryEntry,
  dbStorageGetRecentVibeBatches,
  dbStorageGetVibeState,
  dbStorageUpsertVibeState,
} from "./db-storage-chat-vibe-queries";
export {
  dbStorageCreateUserReminder,
  dbStorageDismissUserReminder,
  dbStorageListDueUserReminders,
  dbStorageUpdateUserReminderFireAt,
} from "./db-storage-user-reminder-queries";
export {
  dbStorageCompleteVoiceTask,
  dbStorageCreateVoiceTask,
  dbStorageListOpenVoiceTasks,
} from "./db-storage-voice-task-queries";

// ── Account / admin / growth ──────────────────────────────────
export {
  dbStorageGetAdminStats,
  dbStorageGetAdminUserSignupRiskSummaries,
  dbStorageListAdmins,
  dbStorageListUsersForAdmin,
  dbStoragePurgeUserPermanently,
  dbStorageSetPlatformRole,
  dbStorageSetUserBlocked,
  dbStorageSetUserDeleted,
} from "./db-storage-admin-queries";
export {
  dbStorageConsumeReferralCode,
  dbStorageCountReferralsByInviter,
  dbStorageCreateReferralCode,
  dbStorageGetReferralCodeByCode,
  dbStorageGetReferralCountsForUserIds,
  dbStorageGetUserRegistrationsByDay,
  dbStorageListActiveReferralCodesByInviter,
  dbStorageListInvitedUsers,
} from "./db-storage-referral-queries";
export {
  dbStorageCreateUser,
  dbStorageFindUsersDiscoverableByPhones,
  dbStorageGetNextPublicId,
  dbStorageGetUser,
  dbStorageGetUserByPhone,
  dbStorageGetUserByPublicId,
  dbStorageSetUserPasswordHash,
  dbStorageGetUsersPublicBriefByIds,
  dbStorageListUsersRelatedBySignupSignals,
  dbStorageSearchUsers,
} from "./db-storage-user-queries";

// ── Chats / messages / folders ───────────────────────────────
export {
  dbStorageAddChatMember,
  dbStorageCreateChat,
  dbStorageDeleteChatCascade,
  dbStorageDeleteChatMemberPrefs,
  dbStorageGetChatByInviteCode,
  dbStorageGetChatByShortCode,
  dbStorageGetChatById,
  dbStorageGetChatMember,
  dbStorageGetChatMemberIds,
  dbStorageGetChatMemberPrefsForUser,
  dbStorageGetChatsForUser,
  dbStorageGetOrCreateDmChat,
  dbStorageRemoveChatMember,
  dbStorageUpdateChat,
  dbStorageUpsertChatMemberPrefs,
} from "./db-storage-chat-core-queries";
export {
  dbStorageCreateUserChatListCustomFolder,
  dbStorageDeleteUserChatListCustomFolder,
  dbStorageGetChatMemberListSection,
  dbStorageGetUserChatListCustomFolder,
  dbStorageIsChatListSectionPushMutedForUser,
  dbStorageListUserChatListBuiltinTabPrefs,
  dbStorageListUserChatListCustomFolders,
  dbStorageNextUserChatListCustomFolderSortOrder,
  dbStorageResetUserChatMemberPrefsListSection,
  dbStorageUpdateUserChatListCustomFolder,
  dbStorageUpsertUserChatListBuiltinTabPrefs,
  isBuiltinChatListSection,
  isCustomChatListFolderId,
} from "./db-storage-user-chat-list-shelves-queries";
export {
  dbStorageGetChatMemberLastReadAt,
  dbStorageGetMediaMessages,
  dbStorageGetMessageCountByFolder,
  dbStorageGetMessagesByChatId,
  dbStorageGetTextMessagesForLinks,
  dbStorageGetUnreadCount,
  dbStorageGetUnreadCountByFolder,
  dbStorageUpdateLastRead,
  dbStorageUpdateLastReadByMessageId,
} from "./db-storage-chat-messages-queries";
export {
  dbStorageAddMessageHidden,
  dbStorageCreateChatFolder,
  dbStorageCreateMessage,
  dbStorageCreateScheduledMessage,
  dbStorageDeleteChatFolder,
  dbStorageDeleteMessage,
  dbStorageDeleteScheduledMessage,
  dbStorageGetChatFolder,
  dbStorageGetHiddenMessageIdsForUserInChat,
  dbStorageGetLastMessage,
  dbStorageGetMessage,
  dbStorageGetMessagesByIdsInChat,
  dbStorageGetMessageById,
  dbStorageGetOrCreateMainFolder,
  dbStorageGetScheduledMessagesDue,
  dbStorageListChatFolders,
  dbStorageUpdateChatFolder,
  dbStorageUpdateMessage,
  dbStorageUpdateMessageTranscript,
} from "./db-storage-chat-folders-and-scheduled-queries";
export {
  dbStorageIsMessageSaved,
  dbStorageListSavedMessages,
  dbStorageSaveMessage,
  dbStorageSearchMessages,
  dbStorageUnsaveMessage,
} from "./db-storage-message-search-saved-queries";

// ── Social graph / profile ───────────────────────────────────
export {
  dbStorageAddBlock,
  dbStorageGetBlockFlags,
  dbStorageGetBlockedRelationIds,
  dbStorageIsBlocked,
  dbStorageRemoveBlock,
} from "./db-storage-user-block-queries";
export {
  dbStorageAddContact,
  dbStorageAddFollow,
  dbStorageCountMutualFollowingWhoFollowTarget,
  dbStorageGetFollowersCount,
  dbStorageGetFollowersList,
  dbStorageGetFollowingCount,
  dbStorageGetFollowingList,
  dbStorageIsContact,
  dbStorageIsFollowing,
  dbStorageListContactUserIds,
  dbStorageListFollowerIds,
  dbStorageListFollowingIds,
  dbStorageListMutualFollowingWhoFollowTarget,
  dbStorageRemoveFollow,
} from "./db-storage-contacts-follow-queries";
export {
  dbStorageAdminSetUserPublicId,
  dbStorageUpdateUserFcmToken,
  dbStorageUpdateUserIosVoipToken,
  dbStorageUpdateUserLastSeen,
  dbStorageUpdateUserProfile,
} from "./db-storage-user-profile-presence-queries";

// ── Calls / tracks ────────────────────────────────────────────
export {
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
} from "./db-storage-call-session-queries";
export {
  dbStorageCreateTrack,
  dbStorageDeleteTrack,
  dbStorageFindBestUserTrackByName,
  dbStorageGetTrack,
  dbStorageGetTracksStats,
  dbStorageListTracks,
  dbStorageUpdateTrack,
} from "./db-storage-tracks-core-queries";
export {
  dbStorageAddCallSegmentToTrack,
  dbStorageAddMessageToTrack,
  dbStorageListTrackItems,
  dbStorageRemoveTrackItem,
  dbStorageSetTrackItemDone,
} from "./db-storage-tracks-items-queries";
