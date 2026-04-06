import { getMoneyChatAccrualTargetsCached } from "./accrual-targets-cache";
import { incrementEdgeMoneyChatCounter } from "./increment-chat-counter";
import { forwardChatMessagesMilestoneToEdge } from "./forward-chat-milestone";
import { isServiceDmChat } from "./is-service-dm-chat";

/**
 * После сохранения исходящего сообщения: счётчики по ЛС и при достижении порога — событие в EDGE.
 * Не бросает наружу (сайд-эффект).
 */
export async function handleUserChatMessageForEdgeMoney(opts: {
  userId: string;
  chatId: string;
  chatType: string | undefined;
  memberCount: number;
  messageType: string;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (opts.messageType === "system") return;
  if (opts.chatType !== "dm" || opts.memberCount !== 2) return;

  const chatId = opts.chatId.trim();
  const userId = opts.userId.trim();
  if (!chatId || !userId) return;

  if (await isServiceDmChat(chatId)) return;

  const targets = await getMoneyChatAccrualTargetsCached(userId);
  if (targets.length === 0) return;

  for (const t of targets) {
    const sent = await incrementEdgeMoneyChatCounter(userId, chatId, t.edgeId);
    if (sent === null) continue;
    const th = t.threshold;
    if (th < 1) continue;
    if (sent > 0 && sent % th === 0) {
      const blockIndex = sent / th;
      void forwardChatMessagesMilestoneToEdge({
        edgeId: t.edgeId,
        platformUserId: userId,
        chatId,
        blockIndex,
      });
    }
  }
}
