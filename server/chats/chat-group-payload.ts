import { storage } from "../storage";

export async function buildGroupChatPayload(
  chatId: string,
  viewerId: string,
  baseChat: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const memberIds = await storage.getChatMemberIds(chatId);
  const members: {
    id: string;
    publicId: number;
    displayName: string | null;
    surname: string | null;
    avatarUrl: string | null;
    role?: string;
  }[] = [];
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
  const [myLastReadAt, unreadCount] = await Promise.all([
    storage.getChatMemberLastReadAt(chatId, viewerId),
    storage.getUnreadCount(chatId, viewerId),
  ]);
  const hasUnread = unreadCount > 0;
  return {
    ...baseChat,
    members,
    avatarUrl: chat.avatarUrl ?? null,
    myRole,
    myLastReadAt: myLastReadAt?.toISOString() ?? null,
    hasUnread,
    unreadCount: hasUnread ? unreadCount : 0,
  };
}
