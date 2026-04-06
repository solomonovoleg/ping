import { storage } from "../storage";

/** lastSeenAt собеседника с учётом настроек приватности «кто видит онлайн». */
export async function getOtherLastSeenAt(
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

export async function buildDmChatPayload(
  chatId: string,
  viewerId: string,
  baseChat: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const memberIds = await storage.getChatMemberIds(chatId);
  const otherId = memberIds.find((id) => id !== viewerId);
  const other = otherId ? await storage.getUser(otherId) : undefined;
  const otherName = other ? [other.displayName, other.surname].filter(Boolean).join(" ") || null : null;
  const [otherLastReadAt, myLastReadAt, unreadCount, blockedByOtherRow, myBlockRow] = await Promise.all([
    otherId ? storage.getChatMemberLastReadAt(chatId, otherId) : Promise.resolve(null),
    storage.getChatMemberLastReadAt(chatId, viewerId),
    storage.getUnreadCount(chatId, viewerId),
    otherId ? storage.getBlockFlags(otherId, viewerId) : Promise.resolve(null),
    otherId ? storage.getBlockFlags(viewerId, otherId) : Promise.resolve(null),
  ]);
  const lastSeenAt = await getOtherLastSeenAt(viewerId, otherId, other);
  const hasUnread = unreadCount > 0;
  const blockedByOther =
    blockedByOtherRow &&
    (blockedByOtherRow.restrictChat ||
      blockedByOtherRow.restrictProfile ||
      blockedByOtherRow.restrictSocial)
      ? {
          restrictChat: blockedByOtherRow.restrictChat,
          restrictProfile: blockedByOtherRow.restrictProfile,
          restrictSocial: blockedByOtherRow.restrictSocial,
          note: blockedByOtherRow.blockNote,
        }
      : null;
  const myBlockOfOther =
    myBlockRow &&
    (myBlockRow.restrictChat || myBlockRow.restrictProfile || myBlockRow.restrictSocial)
      ? {
          restrictChat: myBlockRow.restrictChat,
          restrictProfile: myBlockRow.restrictProfile,
          restrictSocial: myBlockRow.restrictSocial,
        }
      : null;
  return {
    ...baseChat,
    name: otherName,
    myLastReadAt: myLastReadAt?.toISOString() ?? null,
    hasUnread,
    unreadCount: hasUnread ? unreadCount : 0,
    blockedByOther,
    myBlockOfOther,
    otherMember: other
      ? {
          id: other.id,
          publicId: other.publicId,
          displayName: other.displayName,
          surname: other.surname,
          avatarUrl: other.avatarUrl,
          lastReadAt: otherLastReadAt ? otherLastReadAt.toISOString() : null,
          lastSeenAt,
        }
      : null,
  };
}
