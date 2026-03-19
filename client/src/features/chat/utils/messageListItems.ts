/**
 * Построение списка элементов ленты сообщений (даты + сообщения с группировкой).
 */
import type { ApiMessage } from "../types";
import type { MessageListItem } from "../types";
import { getDateSectionLabel, toDateKey, parseMessageDate } from "./format";
import { GROUP_GAP_MIN_MS } from "../constants";

export function buildMessageListItems(messages: ApiMessage[]): MessageListItem[] {
  const out: MessageListItem[] = [];
  let lastDateKey: string | null = null;
  let prevSenderId: string | null = null;
  let prevTime = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isRegular = msg.type !== "system" && msg.type !== "missed_call";
    const msgTime = parseMessageDate(msg.createdAt).getTime();
    const dateKey = toDateKey(msg.createdAt);
    if (dateKey !== lastDateKey) {
      lastDateKey = dateKey;
      out.push({ type: "date", label: getDateSectionLabel(msg.createdAt) });
    }
    let isFirstInGroup = true;
    let isLastInGroup = true;
    if (isRegular) {
      const sameSender = prevSenderId === (msg.senderId ?? null);
      const gapOk = prevTime && msgTime - prevTime <= GROUP_GAP_MIN_MS;
      isFirstInGroup = !sameSender || !gapOk;
      const next = messages[i + 1];
      const nextRegular = next && next.type !== "system" && next.type !== "missed_call";
      const nextSameSender = next && (next.senderId ?? null) === (msg.senderId ?? null);
      const nextGapOk = next && parseMessageDate(next.createdAt).getTime() - msgTime <= GROUP_GAP_MIN_MS;
      isLastInGroup = !nextRegular || !nextSameSender || !nextGapOk;
      prevSenderId = msg.senderId ?? null;
      prevTime = msgTime;
    } else {
      prevSenderId = null;
      prevTime = 0;
    }
    out.push({ type: "message", msg, dateLabel: null, isFirstInGroup, isLastInGroup });
  }
  return out;
}
