import type { ApiChat } from "../types";
import { parseMessageDate } from "./format";

/** GET /chats/:id после WS иногда отстаёт от `chat-read` — не откатывать lastReadAt собеседника. */
export function mergeChatPreservingNewerOtherLastRead(prev: ApiChat | null, next: ApiChat): ApiChat {
  const po = prev?.otherMember;
  const no = next.otherMember;
  if (!prev || !po?.id || !no?.id || po.id !== no.id) return next;
  if (!po.lastReadAt) return next;
  const tPrev = parseMessageDate(po.lastReadAt).getTime();
  if (!Number.isFinite(tPrev)) return next;
  const tNext = no.lastReadAt ? parseMessageDate(no.lastReadAt).getTime() : -Infinity;
  if (tPrev > tNext) {
    return { ...next, otherMember: { ...no, lastReadAt: po.lastReadAt } };
  }
  return next;
}
