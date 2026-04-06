import { getMoneyPostAccrualTargetsCached } from "./accrual-targets-cache";
import { incrementEdgeMoneyPostCounter } from "./increment-post-counter";
import { forwardPostCreatedMilestoneToEdge } from "./forward-post-milestone";

/**
 * После публикации поста (не черновик): счётчик по кампаниям и milestone в EDGE.
 */
export async function handlePostCreatedForEdgeMoney(opts: { userId: string }): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const userId = opts.userId.trim();
  if (!userId) return;

  const targets = await getMoneyPostAccrualTargetsCached(userId);
  if (targets.length === 0) return;

  for (const t of targets) {
    const count = await incrementEdgeMoneyPostCounter(userId, t.edgeId);
    if (count === null) continue;
    const th = t.threshold;
    if (th < 1) continue;
    if (count > 0 && count % th === 0) {
      const blockIndex = count / th;
      void forwardPostCreatedMilestoneToEdge({
        edgeId: t.edgeId,
        platformUserId: userId,
        blockIndex,
      });
    }
  }
}
