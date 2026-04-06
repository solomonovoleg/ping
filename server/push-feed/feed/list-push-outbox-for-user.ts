import type { PushTtlValue } from "@shared/schema";
import {
  selectLatestPushReplies,
  selectPushReactionCounts,
  selectPushReplyCounts,
  selectPushUniqueViewCounts,
  selectViewerPushReactionEmojisByPostIds,
} from "../db/push-engagement.queries";
import { selectPushOutboxRows } from "../db/push-posts.queries";
import { resolveDisplayName } from "../utils/display-name";
import type { PushFeedItem } from "../types/contracts";

export async function listPushOutboxForUser(params: {
  userId: string;
  limit: number;
  offset: number;
}): Promise<PushFeedItem[]> {
  const rows = await selectPushOutboxRows(params.userId, params.limit, params.offset);
  const pushPostIds = rows.map((row) => row.pushId);
  const [reactionCounts, replyCounts, uniqueViewCounts, latestReplies, myReactions] = await Promise.all([
    selectPushReactionCounts(pushPostIds),
    selectPushReplyCounts(pushPostIds),
    selectPushUniqueViewCounts(pushPostIds),
    selectLatestPushReplies(pushPostIds, params.userId),
    selectViewerPushReactionEmojisByPostIds(pushPostIds, params.userId),
  ]);
  return rows.map((row) => {
    const latest = latestReplies.get(row.pushId);
    return {
      id: row.pushId,
      postId: row.postId,
      postLinkCode: row.postLinkCode ?? null,
      postAuthorId: row.authorId,
      postAuthorPublicId: row.authorPublicId ?? null,
      text: row.postText ?? "",
      imageUrl: row.postImageUrl ?? null,
      mediaUrls: Array.isArray(row.postMediaUrls) ? (row.postMediaUrls as string[]) : [],
      createdAt: row.pushCreatedAt?.toISOString?.() ?? row.postCreatedAt?.toISOString?.() ?? new Date().toISOString(),
      expiresAt: row.pushExpiresAt?.toISOString?.() ?? null,
      ttl: row.pushTtl as PushTtlValue,
      uniqueViewsCount: uniqueViewCounts.get(row.pushId) ?? 0,
      reactionsCount: reactionCounts.get(row.pushId) ?? 0,
      repliesCount: replyCounts.get(row.pushId) ?? 0,
      myReaction: myReactions.get(row.pushId) ?? null,
      latestReply: latest
        ? {
            id: latest.id,
            text: latest.text,
            visibility: latest.visibility === "private" ? "private" : "public",
            createdAt: latest.createdAt?.toISOString?.() ?? null,
            author: {
              id: latest.authorId,
              publicId: latest.authorPublicId ?? null,
              displayName: resolveDisplayName({
                displayName: latest.authorDisplayName,
                surname: latest.authorSurname,
                publicId: latest.authorPublicId ?? null,
              }),
              avatarUrl: latest.authorAvatarUrl ?? null,
              isBusiness: false,
              notificationsEnabled: true,
            },
          }
        : null,
      author: {
        id: row.authorId,
        publicId: row.authorPublicId ?? null,
        displayName: resolveDisplayName({
          displayName: row.authorDisplayName,
          surname: row.authorSurname,
          publicId: row.authorPublicId ?? null,
        }),
        avatarUrl: row.authorAvatarUrl ?? null,
        isBusiness: row.authorBusinessStatus === "approved",
        notificationsEnabled: row.subscriptionNotificationsEnabled !== false,
      },
    };
  });
}
