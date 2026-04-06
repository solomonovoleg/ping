import { getMoneyCallAccrualTargetsCached } from "./accrual-targets-cache";
import { incrementEdgeMoneyCallMinutes } from "./increment-call-minutes";
import { forwardVideoCallMinutesMilestoneToEdge } from "./forward-video-call-milestone";

export async function processUserCallMinutesForEdgeMoney(opts: {
  userId: string;
  chatId: string;
  wholeMinutes: number;
}): Promise<void> {
  const userId = opts.userId.trim();
  const chatId = opts.chatId.trim();
  const wholeMinutes = Math.floor(opts.wholeMinutes);
  if (!userId || !chatId || wholeMinutes < 1) return;

  const targets = await getMoneyCallAccrualTargetsCached(userId);
  if (targets.length === 0) return;

  for (const t of targets) {
    const th = t.threshold;
    if (th < 1) continue;
    const newTotal = await incrementEdgeMoneyCallMinutes(userId, chatId, t.edgeId, wholeMinutes);
    if (newTotal === null) continue;
    const oldTotal = newTotal - wholeMinutes;
    const oldBlocks = Math.floor(oldTotal / th);
    const newBlocks = Math.floor(newTotal / th);
    for (let bi = oldBlocks + 1; bi <= newBlocks; bi++) {
      void forwardVideoCallMinutesMilestoneToEdge({
        edgeId: t.edgeId,
        platformUserId: userId,
        chatId,
        blockIndex: bi,
      });
    }
  }
}
