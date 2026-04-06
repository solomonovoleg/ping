import { storage } from "../storage";
import { formatLastMessagePreview } from "./chat-list-preview";
import { getOtherLastSeenAt } from "./chat-dm-payload";
import { getStoryStatusByAuthor } from "./chat-story-status";

export async function listChatsForUser(userId: string, opts?: { hiddenOnly?: boolean }) {
  const prefsMap = await storage.getChatMemberPrefsForUser(userId);
  const hiddenOnly = opts?.hiddenOnly === true;
  let chats = await storage.getChatsForUser(userId);
  chats = chats.filter((c) => {
    const p = prefsMap.get(c.id);
    const isHidden = p?.hiddenAt != null;
    return hiddenOnly ? isHidden : !isHidden;
  });
  const result: Array<
    Awaited<ReturnType<typeof storage.getChatsForUser>>[number] & {
      lastMessage: { type: string; content: string; createdAt: string; senderId: string | null } | null;
      myLastReadAt?: string | null;
      hasUnread?: boolean;
      unreadCount?: number;
      otherMember?: { id: string; publicId: number; lastReadAt?: string | null } | null;
      otherMemberAvatarUrl?: string | null;
      otherMemberLastSeenAt?: string | null;
      otherMemberHasActiveStory?: boolean;
      otherMemberHasUnseenStory?: boolean;
      pinnedAt?: string | null;
      listSection?: string;
      myRole?: "admin" | "member";
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
          senderId: lastMsg.senderId ?? null,
        }
      : null;
    const hasUnread = unreadCount > 0;
    /* Пустой личный чат не показываем в списке, пока не будет хотя бы одного сообщения (открытие диалога без отправки). */
    if (chat.type === "dm" && !lastMessage) {
      continue;
    }
    if (chat.type === "dm" && !chat.name) {
      const memberIds = await storage.getChatMemberIds(chat.id);
      const otherId = memberIds.find((id) => id !== userId);
      const [otherUser, otherLastReadAt] = await Promise.all([
        otherId ? storage.getUser(otherId) : Promise.resolve(undefined),
        otherId ? storage.getChatMemberLastReadAt(chat.id, otherId) : Promise.resolve(null),
      ]);
      const lastSeenAt = await getOtherLastSeenAt(userId, otherId, otherUser);
      if (otherId) dmOtherMemberByChatId.set(chat.id, otherId);
      const pr = prefsMap.get(chat.id);
      result.push({
        ...chat,
        name: otherUser ? [otherUser.displayName, otherUser.surname].filter(Boolean).join(" ") || null : null,
        otherMember: otherUser
          ? {
              id: otherUser.id,
              publicId: otherUser.publicId,
              lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
            }
          : null,
        otherMemberAvatarUrl: otherUser?.avatarUrl ?? null,
        otherMemberLastSeenAt: lastSeenAt,
        otherMemberHasActiveStory: false,
        otherMemberHasUnseenStory: false,
        lastMessage,
        myLastReadAt: myLastReadAt?.toISOString() ?? null,
        hasUnread,
        unreadCount: hasUnread ? unreadCount : 0,
        pinnedAt: pr?.pinnedAt ? pr.pinnedAt.toISOString() : null,
        listSection: pr?.listSection ?? "general",
      });
    } else {
      const pr = prefsMap.get(chat.id);
      const myMember = await storage.getChatMember(chat.id, userId);
      result.push({
        ...chat,
        myRole: myMember?.role === "admin" ? "admin" : "member",
        lastMessage,
        myLastReadAt: myLastReadAt?.toISOString() ?? null,
        hasUnread,
        unreadCount: hasUnread ? unreadCount : 0,
        pinnedAt: pr?.pinnedAt ? pr.pinnedAt.toISOString() : null,
        listSection: pr?.listSection ?? "general",
      });
    }
  }
  const storyStatusByAuthor = await getStoryStatusByAuthor(
    userId,
    Array.from(dmOtherMemberByChatId.values()),
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
    const ap = a.pinnedAt ? Date.parse(a.pinnedAt) : 0;
    const bp = b.pinnedAt ? Date.parse(b.pinnedAt) : 0;
    if (ap !== bp) return bp - ap;
    const aCreatedAt = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt);
    const bCreatedAt = b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt);
    const at = Date.parse(a.lastMessage?.createdAt ?? aCreatedAt);
    const bt = Date.parse(b.lastMessage?.createdAt ?? bCreatedAt);
    return bt - at;
  });
  return result;
}
