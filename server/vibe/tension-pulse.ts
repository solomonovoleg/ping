import { storage } from "../storage";
import { notifyVibeTensionPulse } from "../realtime/chat";
import { findRapidTextBurstWindow, rapidBurstIsNewCycleAfterPulse } from "./tension-pulse-detect";

export { detectRapidTextBurst, findRapidTextBurstWindow } from "./tension-pulse-detect";

/** Защита от двойного WS/повторной обработки одного и того же пика */
const MIN_INTER_PULSE_MS = 1600;

const minInterPulseUntil = new Map<string, number>();

type Anchor = { newestId: string; newestCreatedAt: Date };

/** Якорь последнего импульса: самое новое из шести сообщений, давших эффект */
const lastPulseAnchorByKey = new Map<string, Anchor>();

/**
 * Триггер только при новом исходящем тексте в DM: серия быстрых сообщений одного автора.
 * Атмосфера должна быть включена у обоих (vibeEnabled).
 */
export async function maybeNotifyChatVibeTensionPulse(chatId: string, senderId: string): Promise<void> {
  const chat = await storage.getChatById(chatId);
  if (!chat || chat.type !== "dm") return;

  const memberIds = await storage.getChatMemberIds(chatId);
  if (memberIds.length !== 2 || !memberIds.includes(senderId)) return;

  const [a, b] = await Promise.all([storage.getUser(memberIds[0]!), storage.getUser(memberIds[1]!)]);
  if (!a || !b) return;
  const aEn = (a as { vibeEnabled?: boolean }).vibeEnabled === true;
  const bEn = (b as { vibeEnabled?: boolean }).vibeEnabled === true;
  if (!aEn || !bEn) return;

  const key = `${chatId}:${senderId}`;
  const now = Date.now();
  if ((minInterPulseUntil.get(key) ?? 0) > now) return;

  const recent = await storage.getMessagesByChatId(chatId, 32, undefined, null);

  const prev = lastPulseAnchorByKey.get(key) ?? null;
  const lastNewest = prev
    ? { id: prev.newestId, createdAt: prev.newestCreatedAt }
    : null;
  if (!rapidBurstIsNewCycleAfterPulse(recent, senderId, lastNewest)) return;

  const win = findRapidTextBurstWindow(recent, senderId);
  if (!win?.[0]) return;

  const peakNewest = win[0]!;
  minInterPulseUntil.set(key, now + MIN_INTER_PULSE_MS);
  lastPulseAnchorByKey.set(key, {
    newestId: peakNewest.id,
    newestCreatedAt:
      peakNewest.createdAt instanceof Date ? peakNewest.createdAt : new Date(peakNewest.createdAt),
  });

  notifyVibeTensionPulse(chatId, {
    type: "chat-vibe-tension-pulse",
    chatId,
    senderId,
    at: now,
  });
}
