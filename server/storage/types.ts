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
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByPublicId(publicId: number): Promise<User | undefined>;
  /** Поиск пользователей по номеру телефона, publicId или имени (для глобального поиска). Скрытые из поиска не возвращаются. */
  searchUsers(query: string, excludeUserId: string): Promise<User[]>;
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
  /** Блокировка: пользователь blocker блокирует blocked */
  addBlock(blockerId: string, blockedId: string): Promise<void>;
  removeBlock(blockerId: string, blockedId: string): Promise<void>;
  isBlocked(blockerId: string, blockedId: string): Promise<boolean>;
  /** ID пользователей, с которыми viewer в блоке (кто-то кого-то заблокировал) */
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
  /** Админка: список пользователей с пагинацией (без удалённых по умолчанию) */
  listUsersForAdmin(opts: { limit: number; offset: number; includeDeleted?: boolean; search?: string }): Promise<{ users: User[]; total: number }>;
  setUserBlocked(userId: string, blocked: boolean, opts?: { bannedBy: string; banReason?: string }): Promise<User | undefined>;
  setUserDeleted(userId: string, deleted: boolean): Promise<User | undefined>;
  setPlatformRole(userId: string, role: string): Promise<User | undefined>;
  /** Список пользователей с ролью отличной от user (для раздела «Админы») */
  listAdmins(): Promise<Pick<User, "id" | "publicId" | "phone" | "displayName" | "surname" | "platformRole">[]>;

  /** Реферальные коды: создать приглашение */
  createReferralCode(inviterUserId: string, code: string, expiresAt: Date): Promise<{ id: string; code: string; expiresAt: Date }>;
  /** Найти код по строке (нормализованной), только если не истёк и не использован */
  getReferralCodeByCode(code: string): Promise<{ id: string; inviterUserId: string; expiresAt: Date } | undefined>;
  /** Отметить код как использованный */
  markReferralCodeUsed(codeId: string): Promise<void>;
  /** Сколько пользователей привёл этот inviter */
  countReferralsByInviter(inviterUserId: string): Promise<number>;
  /** Количество приглашённых по списку userId (для админки) */
  getReferralCountsForUserIds(userIds: string[]): Promise<Record<string, number>>;
  /** Активные коды пользователя (не использованы, не истекли) */
  listActiveReferralCodesByInviter(inviterUserId: string): Promise<{ id: string; code: string; expiresAt: Date }[]>;
  /** Список пользователей, приглашённых данным пользователем (для настроек) */
  listInvitedUsers(inviterUserId: string): Promise<Pick<User, "id" | "publicId" | "displayName" | "surname" | "avatarUrl" | "createdAt">[]>;

  getChatById(id: string): Promise<Chat | undefined>;
  /** ID участников чата (для обогащения DM именем собеседника). */
  getChatMemberIds(chatId: string): Promise<string[]>;
  getChatsForUser(userId: string): Promise<Chat[]>;
  /** Найти или создать личный чат между двумя пользователями. */
  getOrCreateDmChat(userId: string, otherUserId: string): Promise<Chat>;
  createChat(data: InsertChat): Promise<Chat>;
  addChatMember(data: InsertChatMember): Promise<ChatMember>;
  updateLastRead(chatId: string, userId: string): Promise<void>;
  getChatMemberLastReadAt(chatId: string, userId: string): Promise<Date | null>;
  getUnreadCount(chatId: string, userId: string): Promise<number>;

  getMessagesByChatId(chatId: string, limit?: number, beforeMessageId?: string): Promise<Message[]>;
  /** Последнее сообщение в чате (для превью в списке) */
  getLastMessage(chatId: string): Promise<Message | undefined>;
  createMessage(data: InsertMessage): Promise<Message>;
  getMessage(chatId: string, messageId: string): Promise<Message | undefined>;
  deleteMessage(chatId: string, messageId: string): Promise<boolean>;
  updateMessage(chatId: string, messageId: string, content: string): Promise<Message | undefined>;

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
}
