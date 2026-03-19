import { storage } from "../storage";
import { notifyChatListUpdate } from "../calls/ws";
import { notifyChatRead } from "../realtime/chat";
import { enrichMessagesWithReply } from "../messages/reply";
import {
  enrichMessagesWithReactions,
  getMyReactionsForMessageIds,
  getReactionsForMessageIds,
} from "../messages/reactions";
import { and, eq, gt, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { stories, storyViews } from "@shared/schema";

export class ChatsServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function formatLastMessagePreview(msg: { type: string; content: string }): string {
  if (msg.type === "missed_call") return "Пропущенный звонок";
  if (msg.type === "post_share") return "Пересланный пост";
  if (msg.type === "story_reply") return "Ответ на сториз";
  if (msg.type === "voice") return "Голосовое сообщение";
  if (msg.type === "image") return "Фото";
  if (msg.type === "video") return "Видео";
  if (msg.type === "video_note") return "Видеокружок";
  if (msg.type === "text") return msg.content.length > 60 ? `${msg.content.slice(0, 57)}…` : msg.content;
  return msg.content?.slice(0, 60) ?? "";
}

async function getOtherLastSeenAt(
  viewerId: string,
  otherId: string | undefined,
  otherUser: Awaited<ReturnType<typeof storage.getUser>>,
): Promise<string | null> {
  if (!otherUser?.lastSeenAt || !otherId) return null;
  const showOnlineTo = (otherUser as { showOnlineTo?: string }).showOnlineTo ?? "all";
  if (showOnlineTo === "all") return (otherUser.lastSeenAt as Date).toISOString();
  if (showOnlineTo === "followers") {
    const following = await storage.isFollowing(viewerId, otherId);
    if (following) return (otherUser.lastSeenAt as Date).toISOString();
  }
  return null;
}

async function getStoryStatusByAuthor(
  viewerId: string,
  authorIds: string[]
): Promise<Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>> {
  const map = new Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>();
  if (authorIds.length === 0) return map;

  const uniqueAuthorIds = Array.from(new Set(authorIds.filter(Boolean)));
  if (uniqueAuthorIds.length === 0) return map;

  const db = getDb();
  const now = new Date();
  const activeStories = await db
    .select({ id: stories.id, authorId: stories.authorId })
    .from(stories)
    .where(and(inArray(stories.authorId, uniqueAuthorIds), gt(stories.expiresAt, now)));

  if (activeStories.length === 0) {
    uniqueAuthorIds.forEach((id) => map.set(id, { hasActiveStory: false, hasUnseenStory: false }));
    return map;
  }

  const storyIds = activeStories.map((s) => s.id);
  const viewedRows = await db
    .select({ storyId: storyViews.storyId })
    .from(storyViews)
    .where(and(eq(storyViews.userId, viewerId), inArray(storyViews.storyId, storyIds)));
  const viewedSet = new Set(viewedRows.map((v) => v.storyId));

  const byAuthor = new Map<string, { hasActiveStory: boolean; hasUnseenStory: boolean }>();
  for (const story of activeStories) {
    const prev = byAuthor.get(story.authorId) ?? { hasActiveStory: false, hasUnseenStory: false };
    byAuthor.set(story.authorId, {
      hasActiveStory: true,
      hasUnseenStory: prev.hasUnseenStory || !viewedSet.has(story.id),
    });
  }
  uniqueAuthorIds.forEach((id) => map.set(id, byAuthor.get(id) ?? { hasActiveStory: false, hasUnseenStory: false }));
  return map;
}

async function buildDmChatPayload(
  chatId: string,
  viewerId: string,
  baseChat: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const memberIds = await storage.getChatMemberIds(chatId);
  const otherId = memberIds.find((id) => id !== viewerId);
  const other = otherId ? await storage.getUser(otherId) : undefined;
  const otherName = other ? [other.displayName, other.surname].filter(Boolean).join(" ") || null : null;
  const otherLastReadAt = otherId ? await storage.getChatMemberLastReadAt(chatId, otherId) : null;
  const lastSeenAt = await getOtherLastSeenAt(viewerId, otherId, other);
  return {
    ...baseChat,
    name: otherName,
    otherMember: other
      ? {
          id: other.id,
          publicId: other.publicId,
          displayName: other.displayName,
          surname: other.surname,
          avatarUrl: other.avatarUrl,
          phone: other.phone ?? null,
          lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
          lastSeenAt,
        }
      : null,
  };
}

export async function listChatsForUser(userId: string) {
  const chats = await storage.getChatsForUser(userId);
  const result: Array<
    Awaited<ReturnType<typeof storage.getChatsForUser>>[number] & {
      lastMessage: { type: string; content: string; createdAt: string } | null;
      myLastReadAt?: string | null;
      hasUnread?: boolean;
      unreadCount?: number;
      otherMember?: { id: string; publicId: number } | null;
      otherMemberAvatarUrl?: string | null;
      otherMemberLastSeenAt?: string | null;
      otherMemberHasActiveStory?: boolean;
      otherMemberHasUnseenStory?: boolean;
    }
  > = [];
  const dmOtherMemberByChatId = new Map<string, string>();
  for (const chat of chats) {
    const [lastMsg, myLastReadAt, unreadCount] = await Promise.all([
      storage.getLastMessage(chat.id),
      storage.getChatMemberLastReadAt(chat.id, userId),
      storage.getUnreadCount(chat.id, userId),
    ]);
    const lastMessage = lastMsg
      ? {
          type: lastMsg.type,
          content: formatLastMessagePreview(lastMsg),
          createdAt: lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : String(lastMsg.createdAt),
        }
      : null;
    const hasUnread = unreadCount > 0;
    if (chat.type === "dm" && !chat.name) {
      const memberIds = await storage.getChatMemberIds(chat.id);
      const otherId = memberIds.find((id) => id !== userId);
      const otherUser = otherId ? await storage.getUser(otherId) : undefined;
      const lastSeenAt = await getOtherLastSeenAt(userId, otherId, otherUser);
      if (otherId) dmOtherMemberByChatId.set(chat.id, otherId);
      result.push({
        ...chat,
        name: otherUser ? [otherUser.displayName, otherUser.surname].filter(Boolean).join(" ") || null : null,
        otherMember: otherUser ? { id: otherUser.id, publicId: otherUser.publicId } : null,
        otherMemberAvatarUrl: otherUser?.avatarUrl ?? null,
        otherMemberLastSeenAt: lastSeenAt,
        otherMemberHasActiveStory: false,
        otherMemberHasUnseenStory: false,
        lastMessage,
        myLastReadAt: myLastReadAt?.toISOString() ?? null,
        hasUnread,
        unreadCount: hasUnread ? unreadCount : 0,
      });
    } else {
      result.push({
        ...chat,
        lastMessage,
        myLastReadAt: myLastReadAt?.toISOString() ?? null,
        hasUnread,
        unreadCount: hasUnread ? unreadCount : 0,
      });
    }
  }
  const storyStatusByAuthor = await getStoryStatusByAuthor(
    userId,
    Array.from(dmOtherMemberByChatId.values())
  );
  for (const chat of result) {
    if (chat.type !== "dm") continue;
    const otherId = dmOtherMemberByChatId.get(chat.id);
    if (!otherId) continue;
    const status = storyStatusByAuthor.get(otherId) ?? { hasActiveStory: false, hasUnseenStory: false };
    chat.otherMemberHasActiveStory = status.hasActiveStory;
    chat.otherMemberHasUnseenStory = status.hasUnseenStory;
  }
  result.sort((a, b) => {
    const aCreatedAt = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt);
    const bCreatedAt = b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt);
    const at = Date.parse(a.lastMessage?.createdAt ?? aCreatedAt);
    const bt = Date.parse(b.lastMessage?.createdAt ?? bCreatedAt);
    return bt - at;
  });
  return result;
}

export async function getDmByPublicId(userId: string, publicIdNum: number, messagesLimit: number) {
  if (Number.isNaN(publicIdNum) || publicIdNum < 0) {
    throw new ChatsServiceError(400, "Некорректный ID");
  }
  const otherUser = await storage.getUserByPublicId(publicIdNum);
  if (!otherUser) {
    throw new ChatsServiceError(404, "Пользователь не найден");
  }
  if (otherUser.id === userId) {
    throw new ChatsServiceError(400, "Нельзя открыть чат с собой");
  }
  const chat = await storage.getOrCreateDmChat(userId, otherUser.id);
  const chatPayload = await buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);

  if (messagesLimit > 0) {
    const raw = await storage.getMessagesByChatId(chat.id, messagesLimit);
    const withReply = await enrichMessagesWithReply(raw, (c, m) => storage.getMessage(c, m));
    const msgIds = withReply.map((m) => m.id);
    const reactionMap = process.env.DATABASE_URL
      ? await getReactionsForMessageIds(msgIds)
      : new Map<string, { emoji: string; count: number }[]>();
    const myReactionMap = process.env.DATABASE_URL
      ? await getMyReactionsForMessageIds(userId, msgIds)
      : undefined;
    const messages = enrichMessagesWithReactions(withReply, reactionMap, myReactionMap);
    return { chat: chatPayload, messages };
  }
  return chatPayload;
}

async function buildGroupChatPayload(
  chatId: string,
  viewerId: string,
  baseChat: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const memberIds = await storage.getChatMemberIds(chatId);
  const members: { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null; role?: string }[] = [];
  let myRole: string | null = null;
  for (const id of memberIds) {
    const u = await storage.getUser(id);
    const m = await storage.getChatMember(chatId, id);
    members.push({
      id,
      publicId: u?.publicId ?? 0,
      displayName: u?.displayName ?? null,
      surname: u?.surname ?? null,
      avatarUrl: u?.avatarUrl ?? null,
      role: m?.role ?? "member",
    });
    if (id === viewerId) myRole = m?.role ?? "member";
  }
  const chat = baseChat as { avatarUrl?: string | null };
  return { ...baseChat, members, avatarUrl: chat.avatarUrl ?? null, myRole };
}

export async function getChatByIdForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) {
    throw new ChatsServiceError(404, "Chat not found");
  }
  const memberIds = await storage.getChatMemberIds(chat.id);
  if (!memberIds.includes(userId)) {
    throw new ChatsServiceError(404, "Chat not found");
  }
  if (chat.type === "dm" && !chat.name) {
    return buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);
  }
  if (chat.type === "group") {
    return buildGroupChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);
  }
  return chat;
}

export async function markChatRead(chatId: string, userId: string, messageId?: string): Promise<void> {
  const chat = await storage.getChatById(chatId);
  if (!chat) {
    throw new ChatsServiceError(404, "Chat not found");
  }
  if (!messageId) return;
  await storage.updateLastReadByMessageId(chatId, userId, messageId);
  const lastReadAt = await storage.getChatMemberLastReadAt(chatId, userId);
  if (lastReadAt) {
    notifyChatRead(chatId, userId, lastReadAt.toISOString());
  }
}

export async function createChatForUser(
  userId: string,
  type: unknown,
  name: unknown,
  memberIds: unknown,
) {
  const chat = await storage.createChat({
    type: type === "group" ? "group" : "dm",
    name: typeof name === "string" ? name || null : null,
  });
  await storage.addChatMember({ chatId: chat.id, userId, role: "admin" });
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    for (const uid of memberIds) {
      if (uid !== userId) {
        await storage.addChatMember({ chatId: chat.id, userId: String(uid), role: "member" });
      }
    }
  }
  if (chat.type === "group") {
    await storage.getOrCreateMainFolder(chat.id);
  }
  return chat;
}

export async function searchMessagesForUser(userId: string, q: string) {
  const list = await storage.searchMessages(userId, q, 30);
  return list.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function updateChatForUser(
  userId: string,
  chatId: string,
  data: { name?: string; avatarUrl?: string }
) {
  const chat = await storage.getChatById(chatId);
  if (!chat) return undefined;
  const memberIds = await storage.getChatMemberIds(chat.id);
  if (!memberIds.includes(userId)) return undefined;
  if (chat.type !== "group") return undefined;
  const updated = await storage.updateChat(chatId, data);
  return updated;
}

export async function addMemberToGroup(actorUserId: string, chatId: string, newUserId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Некорректный чат");
  const actorMember = await storage.getChatMember(chatId, actorUserId);
  if (!actorMember || actorMember.role !== "admin") throw new ChatsServiceError(403, "Только администратор может добавлять участников");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (memberIds.includes(newUserId)) throw new ChatsServiceError(400, "Пользователь уже в группе");
  const other = await storage.getUser(newUserId);
  if (!other) throw new ChatsServiceError(404, "Пользователь не найден");
  await storage.addChatMember({ chatId, userId: newUserId, role: "member" });
  notifyChatListUpdate(newUserId);
  return getChatByIdForUser(actorUserId, chatId);
}

export async function listChatFoldersForUser(userId: string, chatId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  if (chat.type !== "group") return [];
  const folders = await storage.listChatFolders(chatId);
  const withUnread = await Promise.all(
    folders.map(async (f) => {
      const folderIdForUnread = f.isMain ? null : f.id;
      const unreadCount = await storage.getUnreadCountByFolder(chatId, folderIdForUnread, userId);
      return {
        id: f.id,
        chatId: f.chatId,
        name: f.name,
        isMain: f.isMain,
        orderIndex: f.orderIndex,
        createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        unreadCount,
      };
    })
  );
  return withUnread;
}

export async function createChatFolderForUser(userId: string, chatId: string, name: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Папки только в групповых чатах");
  const member = await storage.getChatMember(chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может создавать папки");
  const folders = await storage.listChatFolders(chatId);
  const folder = await storage.createChatFolder(chatId, name.trim(), folders.length);
  return {
    id: folder.id,
    chatId: folder.chatId,
    name: folder.name,
    isMain: folder.isMain,
    orderIndex: folder.orderIndex,
    createdAt: folder.createdAt instanceof Date ? folder.createdAt.toISOString() : String(folder.createdAt),
  };
}

export async function updateChatFolderForUser(userId: string, folderId: string, data: { name: string }) {
  const folder = await storage.getChatFolder(folderId);
  if (!folder) throw new ChatsServiceError(404, "Папка не найдена");
  const memberIds = await storage.getChatMemberIds(folder.chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const member = await storage.getChatMember(folder.chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может редактировать папки");
  const updated = await storage.updateChatFolder(folderId, data);
  if (!updated) throw new ChatsServiceError(500, "Не удалось обновить");
  return {
    id: updated.id,
    chatId: updated.chatId,
    name: updated.name,
    isMain: updated.isMain,
    orderIndex: updated.orderIndex,
    createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : String(updated.createdAt),
  };
}

export async function deleteChatFolderForUser(userId: string, folderId: string) {
  const folder = await storage.getChatFolder(folderId);
  if (!folder) throw new ChatsServiceError(404, "Папка не найдена");
  const memberIds = await storage.getChatMemberIds(folder.chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const member = await storage.getChatMember(folder.chatId, userId);
  if (!member || member.role !== "admin") throw new ChatsServiceError(403, "Только администратор может удалять папки");
  const deleted = await storage.deleteChatFolder(folderId);
  if (!deleted) throw new ChatsServiceError(400, "Нельзя удалить основную папку");
  return { ok: true };
}

export async function removeMemberFromGroup(actorUserId: string, chatId: string, targetUserId: string) {
  const chat = await storage.getChatById(chatId);
  if (!chat) throw new ChatsServiceError(404, "Чат не найден");
  if (chat.type !== "group") throw new ChatsServiceError(400, "Некорректный чат");
  const actorMember = await storage.getChatMember(chatId, actorUserId);
  if (!actorMember || actorMember.role !== "admin") throw new ChatsServiceError(403, "Только администратор может исключать участников");
  if (actorUserId === targetUserId) throw new ChatsServiceError(400, "Нельзя исключить себя");
  const removed = await storage.removeChatMember(chatId, targetUserId);
  if (!removed) throw new ChatsServiceError(404, "Участник не найден");
  notifyChatListUpdate(targetUserId);
  return getChatByIdForUser(actorUserId, chatId);
}

export async function startDmForUser(userId: string, otherUserId: string) {
  if (!otherUserId || otherUserId === userId) {
    throw new ChatsServiceError(400, "Укажите ID пользователя для начала диалога");
  }
  const other = await storage.getUser(otherUserId);
  if (!other) {
    throw new ChatsServiceError(404, "Пользователь не найден");
  }
  const chat = await storage.getOrCreateDmChat(userId, otherUserId);
  notifyChatListUpdate(otherUserId);
  return buildDmChatPayload(chat.id, userId, chat as unknown as Record<string, unknown>);
}

const URL_REGEX = /https?:\/\/[^\s<>]+/g;

export async function getChatMediaForUser(userId: string, chatId: string, folderId: string | null, limit: number, beforeMessageId?: string) {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const rows = await storage.getMediaMessages(chatId, folderId, Math.min(limit, 50), beforeMessageId);
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
  }));
}

export async function getChatLinksForUser(userId: string, chatId: string, folderId: string | null, limit: number, beforeMessageId?: string) {
  const memberIds = await storage.getChatMemberIds(chatId);
  if (!memberIds.includes(userId)) throw new ChatsServiceError(403, "Нет доступа");
  const rows = await storage.getTextMessagesForLinks(chatId, folderId, Math.min(limit, 100), beforeMessageId);
  const links: { url: string; messageId: string; createdAt: string }[] = [];
  for (const row of rows) {
    const matches = row.content.match(URL_REGEX);
    if (matches) {
      const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt);
      for (const url of matches) {
        links.push({ url, messageId: row.id, createdAt });
        if (links.length >= 50) break;
      }
    }
    if (links.length >= 50) break;
  }
  return links;
}
