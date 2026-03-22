import type {
  User,
  InsertUser,
  UpdateProfile,
  Chat,
  ChatMember,
  InsertChat,
  InsertChatMember,
  Message,
  InsertMessage,
  ChatFolder,
  InsertChatFolder,
  ChatVibeState,
  ChatVibeBatch,
  ChatVibeHistoryEntry,
  CallSessionHistory,
  CallParticipantHistory,
  CallTranscriptSegment,
  CallCommandSuggestion,
} from "@shared/schema";
import type { VibeAxes, VibeThemeCode } from "@shared/chat-vibe-types";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByPublicId(publicId: number): Promise<User | undefined>;
  /** Поиск пользователей по номеру телефона, publicId или имени (для глобального поиска). Скрытые из поиска не возвращаются. */
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;
  /** Пользователи с номерами из списка (нормализованные +7…), исключая viewer; только активные, не в блоке модерации, не скрытые из поиска. */
  findUsersDiscoverableByPhones(phones: string[], excludeUserId: string): Promise<User[]>;
  /** Контакты: проверка и управление */
  isContact(ownerId: string, contactUserId: string): Promise<boolean>;
  addContact(ownerId: string, contactUserId: string): Promise<void>;
  listContactUserIds(ownerId: string): Promise<string[]>;

  /** Подписки (как в Instagram): лента = посты от тех, на кого подписан */
  addFollow(followerId: string, followingId: string): Promise<void>;
  removeFollow(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  listFollowingIds(followerId: string): Promise<string[]>;
  listFollowerIds(userId: string): Promise<string[]>;
  getFollowersCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  getFollowersList(userId: string, limit: number, offset: number): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>;
  getFollowingList(userId: string, limit: number, offset: number): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>;
  /**
   * Из тех, на кого подписан viewer, кто ещё подписан на target (для строки «N общих подписчиков»).
   */
  countMutualFollowingWhoFollowTarget(viewerId: string, targetUserId: string): Promise<number>;
  listMutualFollowingWhoFollowTarget(
    viewerId: string,
    targetUserId: string,
    limit: number
  ): Promise<{ id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null }[]>;
  /** Блокировка: пользователь blocker блокирует blocked (флаги по умолчанию все true) */
  addBlock(
    blockerId: string,
    blockedId: string,
    flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
  ): Promise<void>;
  removeBlock(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  /** Флаги блокировки blocker → blocked; null если записи нет */
  getBlockFlags(
    blockerId: string,
    blockedId: string,
  ): Promise<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean } | null>;
  /**
   * ID пользователей, которых нужно скрыть из ленты: есть блокировка с тремя флагами true
   * (полная блокировка) в любую сторону между viewer и этим пользователем.
   */
  getBlockedRelationIds(viewerId: string): Promise<string[]>;
  getNextPublicId(): Promise<number>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: string, data: UpdateProfile): Promise<User | undefined>;
  /** Обновить время последней активности (для статуса «в сети») */
  updateUserLastSeen(userId: string): Promise<void>;
  /** Сохранить FCM токен для пуш-уведомлений */
  updateUserFcmToken(userId: string, token: string | null): Promise<void>;

  /** Админка: статистика пользователей */
  getAdminStats(): Promise<{ total: number; blocked: number; deleted: number; registeredToday: number }>;
  /** Админка: регистрации по дням (UTC), без удалённых */
  getUserRegistrationsByDay(days: number): Promise<{ day: string; count: number }[]>;
  /** Админка: список пользователей с пагинацией (без удалённых по умолчанию) */
  listUsersForAdmin(opts: { limit: number; offset: number; includeDeleted?: boolean; search?: string }): Promise<{ users: User[]; total: number }>;
  setUserBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }): Promise<User | undefined>;
  setUserDeleted(userId: string, deleted: boolean): Promise<User | undefined>;
  setPlatformRole(userId: string, role: string): Promise<User | undefined>;
  /** Список пользователей с ролью отличной от user (для раздела «Админы») */
  listAdmins(): Promise<Pick<User, "id" | "publicId" | "phone" | "displayName" | "surname" | "platformRole">[]>;

  /** Реферальные коды: создать приглашение (maxUses: -1 = без лимита до истечения) */
  createReferralCode(
    inviterUserId: string,
    code: string,
    expiresAt: Date,
    opts?: { maxUses?: number }
  ): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number }>;
  /** Найти код по строке (нормализованной), только если не истёк и остались использования */
  getReferralCodeByCode(code: string): Promise<{ id: string; inviterUserId: string; expiresAt: Date } | undefined>;
  /** Списать одно использование кода при регистрации */
  consumeReferralCode(codeId: string): Promise<boolean>;
  /** Сколько пользователей привёл этот inviter */
  countReferralsByInviter(inviterUserId: string): Promise<number>;
  /** Количество приглашённых по списку userId (для админки) */
  getReferralCountsForUserIds(userIds: string[]): Promise<Record<string, number>>;
  /** Активные коды пользователя (есть оставшиеся использования, не истекли) */
  listActiveReferralCodesByInviter(
    inviterUserId: string
  ): Promise<{ id: string; code: string; expiresAt: Date; maxUses: number; useCount: number }[]>;
  /** Список пользователей, приглашённых данным пользователем (для настроек) */
  listInvitedUsers(inviterUserId: string): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]>;

  getChatById(id: string): Promise<Chat | undefined>;
  /** Участник чата (для проверки роли). */
  getChatMember(chatId: string, userId: string): Promise<ChatMember | undefined>;
  /** ID участников чата (для обогащения DM именем собеседника). */
  getChatMemberIds(chatId: string): Promise<string[]>;
  getChatsForUser(userId: string): Promise<Chat[]>;
  /** Персональные настройки списка чатов для пользователя (по chat_id). */
  getChatMemberPrefsForUser(userId: string): Promise<
    Map<string, { pinnedAt: Date | null; hiddenAt: Date | null; listSection: string }>
  >;
  upsertChatMemberPrefs(
    userId: string,
    chatId: string,
    data: {
      pinnedAt?: Date | null;
      hiddenAt?: Date | null;
      listSection?: string;
    }
  ): Promise<void>;
  deleteChatMemberPrefs(userId: string, chatId: string): Promise<void>;
  /** Удалить чат и связанные данные (сообщения, папки — каскадом в БД). */
  deleteChatCascade(chatId: string): Promise<boolean>;
  /** Найти или создать личный чат между двумя пользователями. */
  getOrCreateDmChat(userId: string, otherUserId: string): Promise<Chat>;
  createChat(data: InsertChat): Promise<Chat>;
  addChatMember(data: InsertChatMember): Promise<ChatMember>;
  removeChatMember(chatId: string, userId: string): Promise<boolean>;
  updateChat(chatId: string, data: { name?: string; avatarUrl?: string }): Promise<Chat | undefined>;
  updateLastRead(chatId: string, userId: string, readUpTo?: Date): Promise<void>;
  /** Обновить lastReadAt напрямую из messages.created_at (сохраняет микросекундную точность PostgreSQL). */
  updateLastReadByMessageId(chatId: string, userId: string, messageId: string): Promise<void>;
  getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null>;
  getUnreadCount(chatId: string, userId: string): Promise<number>;
  /** Непрочитанные в папке: folderId=null для основной папки (сообщения без folderId). */
  getUnreadCountByFolder(chatId: string, folderId: string | null, userId: string): Promise<number>;
  /** Число сообщений с данным folder_id (в т.ч. основная папка — её uuid). */
  getMessageCountByFolder(chatId: string, folderId: string): Promise<number>;

  getMessagesByChatId(chatId: string, limit?: number, beforeMessageId?: string, folderId?: string | null): Promise<Message[]>;
  /** Медиа-сообщения (image, video, voice, video_note) для панели «Медиафайлы». */
  getMediaMessages(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string): Promise<Message[]>;
  /** Текстовые сообщения для извлечения ссылок (панель «Ссылки»). */
  getTextMessagesForLinks(chatId: string, folderId: string | null, limit: number, beforeMessageId?: string): Promise<Pick<Message, "id" | "content" | "createdAt">[]>;

  /** Последнее сообщение в чате (для превью в списке) */
  getLastMessage(chatId: string): Promise<Message | undefined>;
  createMessage(data: InsertMessage): Promise<Message>;
  getMessage(chatId: string, messageId: string): Promise<Message | undefined>;
  deleteMessage(chatId: string, messageId: string): Promise<boolean>;
  updateMessage(chatId: string, messageId: string, content: string): Promise<Message | undefined>;
  updateMessageTranscript(chatId: string, messageId: string, transcript: string): Promise<Message | undefined>;

  /** «Удалено для себя»: скрыть сообщение для пользователя. */
  addMessageHidden(userId: string, chatId: string, messageId: string): Promise<void>;
  /** ID сообщений, скрытых пользователем в чате. */
  getHiddenMessageIdsForUserInChat(userId: string, chatId: string): Promise<string[]>;

  /** Отложенная отправка: создать запись, получить просроченные, удалить. */
  createScheduledMessage(data: {
    chatId: string;
    folderId?: string | null;
    senderId: string;
    type: string;
    content: string;
    replyToId?: string | null;
    scheduledAt: Date;
  }): Promise<{ id: string; scheduledAt: Date }>;
  getScheduledMessagesDue(limit: number): Promise<
    { id: string; chatId: string; folderId: string | null; senderId: string | null; type: string; content: string; replyToId: string | null }[]
  >;
  deleteScheduledMessage(id: string): Promise<boolean>;

  /** Папки группового чата: основной поток + второстепенные. */
  listChatFolders(chatId: string): Promise<ChatFolder[]>;
  getOrCreateMainFolder(chatId: string): Promise<ChatFolder>;
  createChatFolder(chatId: string, name: string, orderIndex: number): Promise<ChatFolder>;
  getChatFolder(folderId: string): Promise<ChatFolder | undefined>;
  updateChatFolder(folderId: string, data: { name?: string }): Promise<ChatFolder | undefined>;
  deleteChatFolder(folderId: string): Promise<boolean>;

  /** Поиск по тексту сообщений в чатах, где пользователь участник. */
  searchMessages(
    userId: string,
    query: string,
    limit: number
  ): Promise<{ messageId: string; chatId: string; content: string; createdAt: Date; chatName: string }[]>;

  /** Избранное: сохранить сообщение для пользователя. */
  saveMessage(userId: string, messageId: string, chatId: string): Promise<void>;
  unsaveMessage(userId: string, messageId: string): Promise<void>;
  listSavedMessages(
    userId: string,
    limit: number,
    offset: number
  ): Promise<
    {
      messageId: string;
      chatId: string;
      savedAt: Date;
      content: string;
      type: string;
      chatName: string;
    }[]
  >;
  isMessageSaved(userId: string, messageId: string): Promise<boolean>;

  /** Треки: списки сообщений пользователя */
  createTrack(userId: string, name: string): Promise<{ id: string; name: string; createdAt: Date }>;
  listTracks(userId: string): Promise<{ id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]>;
  getTrack(userId: string, trackId: string): Promise<{ id: string; name: string; createdAt: Date } | undefined>;
  addMessageToTrack(userId: string, trackId: string, messageId: string, chatId: string): Promise<void>;
  addCallSegmentToTrack(userId: string, trackId: string, segmentId: string): Promise<void>;
  removeTrackItem(userId: string, trackId: string, itemId: string): Promise<void>;
  setTrackItemDone(userId: string, trackId: string, itemId: string, done: boolean): Promise<void>;
  updateTrack(userId: string, trackId: string, data: { name: string }): Promise<void>;
  deleteTrack(userId: string, trackId: string): Promise<void>;
  getTracksStats(userId: string): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }>;
  listTrackItems(
    userId: string,
    trackId: string
  ): Promise<
    {
      id: string;
      sourceType: "message" | "call_segment";
      messageId: string | null;
      chatId: string | null;
      callId: string | null;
      chatName: string;
      speakerDisplayName: string | null;
      content: string;
      type: string;
      messageCreatedAt: Date;
      addedAt: Date;
      doneAt: Date | null;
    }[]
  >;
  createCallSessionHistory(data: {
    id: string;
    chatId: string;
    mediaType: "audio" | "video";
    createdByUserId: string;
  }): Promise<CallSessionHistory>;
  endCallSessionHistory(callId: string): Promise<void>;
  upsertCallParticipantHistory(callId: string, userId: string, displayNameSnapshot: string): Promise<CallParticipantHistory>;
  markCallParticipantLeft(callId: string, userId: string): Promise<void>;
  upsertCallTranscriptSegment(data: {
    id: string;
    callId: string;
    speakerUserId: string;
    speakerDisplayName: string;
    sourceStreamId?: string | null;
    language?: string;
    textRaw: string;
    textNormalized: string;
    confidence: number;
    startedAtMs: number;
    endedAtMs: number;
    isFinal: boolean;
  }): Promise<CallTranscriptSegment>;
  getCallTranscriptSegment(callId: string, segmentId: string): Promise<CallTranscriptSegment | undefined>;
  listCallTranscriptSegments(userId: string, callId: string): Promise<CallTranscriptSegment[]>;
  listCallSessionsHistory(userId: string): Promise<Array<CallSessionHistory & { participantCount: number; chatName: string }>>;
  createCallCommandSuggestion(data: {
    callId: string;
    segmentId?: string | null;
    intentType: string;
    title: string;
    payloadJson: string;
  }): Promise<CallCommandSuggestion>;
  listCallCommandSuggestions(userId: string, callId: string): Promise<CallCommandSuggestion[]>;
  resolveCallCommandSuggestion(
    userId: string,
    callId: string,
    suggestionId: string,
    status: "accepted" | "dismissed",
  ): Promise<void>;

  /** Chat Vibe: текущее состояние вайба DM-чата */
  getVibeState(chatId: string): Promise<ChatVibeState | undefined>;
  upsertVibeState(
    chatId: string,
    data: {
      theme: VibeThemeCode;
      confidence: number;
      axes: VibeAxes;
      messageCounter: number;
      themeVersion?: number;
      /** true только после реального батч-анализа — иначе кулдаун вайба никогда не проходил */
      touchLastBatchAt?: boolean;
    }
  ): Promise<ChatVibeState>;
  createVibeBatch(data: {
    chatId: string;
    windowSize: number;
    dominantPattern: VibeThemeCode;
    secondaryPattern?: VibeThemeCode;
    confidence: number;
    axes: VibeAxes;
    toxicityFlag?: boolean;
  }): Promise<ChatVibeBatch>;
  getRecentVibeBatches(chatId: string, limit: number): Promise<ChatVibeBatch[]>;
  createVibeHistoryEntry(data: {
    chatId: string;
    oldTheme: string;
    newTheme: string;
    oldConfidence: number;
    newConfidence: number;
    triggerType: string;
  }): Promise<ChatVibeHistoryEntry>;
}
