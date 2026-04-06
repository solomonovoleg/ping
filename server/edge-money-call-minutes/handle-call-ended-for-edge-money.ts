import { storage } from "../storage";
import { isServiceDmChat } from "../edge-money-chat-messages/is-service-dm-chat";
import { processUserCallMinutesForEdgeMoney } from "./process-user-call-minutes";

export type CallEndedMoneyPayload = {
  chatId: string;
  callerId: string;
  calleeId: string;
  connectedAt: number;
  endedAt: number;
};

/**
 * После завершения звонка 1:1 с фазой connected: начисляем полные минуты обоим участникам.
 * Групповые созвоны (`server/group-calls/`) сюда не попадают — другой стек и проверка `dm` + ровно 2 участника.
 */
export async function handleCallEndedForEdgeMoney(payload: CallEndedMoneyPayload): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const { chatId, callerId, calleeId, connectedAt, endedAt } = payload;
  const c = chatId.trim();
  if (!c || !callerId.trim() || !calleeId.trim()) return;
  if (!(endedAt > connectedAt)) return;

  const wholeMinutes = Math.floor((endedAt - connectedAt) / 60_000);
  if (wholeMinutes < 1) return;

  const chat = await storage.getChatById(c);
  if (chat?.type !== "dm") return;
  const members = await storage.getChatMemberIds(c);
  if (members.length !== 2) return;
  if (await isServiceDmChat(c)) return;

  await processUserCallMinutesForEdgeMoney({ userId: callerId, chatId: c, wholeMinutes });
  await processUserCallMinutesForEdgeMoney({ userId: calleeId, chatId: c, wholeMinutes });
}
