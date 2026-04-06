import { getMoneyProfileLikeAccrualTargetsCached } from "./accrual-targets-cache";
import { incrementEdgeMoneyProfileLikeCounter } from "./increment-profile-like-counter";
import { forwardProfileLikeMilestoneToEdge } from "./forward-profile-like-milestone";

/**
 * Первая реакция пользователя на пост автора (не смена эмодзи): счётчик для автора по кампаниям.
 */
export async function handleProfileLikeForEdgeMoney(opts: {
  recipientUserId: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const recipientUserId = opts.recipientUserId.trim();
  if (!recipientUserId) return;

  const targets = await getMoneyProfileLikeAccrualTargetsCached(recipientUserId);
  if (targets.length === 0) return;

  for (const t of targets) {
    const count = await incrementEdgeMoneyProfileLikeCounter(recipientUserId, t.edgeId);
    if (count === null) continue;
    const th = t.threshold;
    if (th < 1) continue;
    if (count > 0 && count % th === 0) {
      const blockIndex = count / th;
      void forwardProfileLikeMilestoneToEdge({
        edgeId: t.edgeId,
        platformUserId: recipientUserId,
        blockIndex,
      });
    }
  }
}
