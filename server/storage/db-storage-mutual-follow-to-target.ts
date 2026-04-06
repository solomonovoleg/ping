import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { follows, users } from "@shared/schema";

const FOLLOWS_MUTUAL_ALIAS = "follows_mutual_to_target" as const;

/**
 * Два экземпляра `follows` и общее условие: пользователи, на которых подписан viewer,
 * и которые сами подписаны на target (для mutual / «общие подписки»).
 */
export function mutualFollowToTargetJoinBundle(viewerId: string, targetUserId: string) {
  const fViewer = follows;
  const fMutual = alias(follows, FOLLOWS_MUTUAL_ALIAS);
  const baseWhere = and(
    eq(fViewer.followerId, viewerId),
    eq(fMutual.followingId, targetUserId),
    isNull(users.deletedAt),
    eq(users.isBlocked, false),
  );
  return { fViewer, fMutual, baseWhere };
}
