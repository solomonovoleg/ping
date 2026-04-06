import { parseMessageDate } from "../../utils/format";
import type { ApiMessage } from "../../types";

/**
 * Последняя страница с сервера (хвост треда) вмержить в текущий список.
 * Сообщения старше окна сохраняем (пользователь мог догрузить историю вверх).
 * temp-/obq- оставляем для mergeOutbox.
 */
export function mergeLatestServerTail(
  prev: ApiMessage[],
  tail: ApiMessage[],
): { next: ApiMessage[]; olderCount: number; tailLen: number } {
  const tailLen = tail.length;
  if (tailLen === 0) {
    return { next: prev, olderCount: 0, tailLen: 0 };
  }
  const minTailMs = parseMessageDate(tail[0].createdAt).getTime();
  const pending = prev.filter((m) => m.id.startsWith("temp-") || m.id.startsWith("obq-"));
  const older = prev.filter((m) => {
    if (m.id.startsWith("temp-") || m.id.startsWith("obq-")) return false;
    const t = parseMessageDate(m.createdAt).getTime();
    return Number.isFinite(t) && t < minTailMs;
  });
  const byId = new Map<string, ApiMessage>();
  for (const m of older) byId.set(m.id, m);
  for (const m of tail) byId.set(m.id, m);
  for (const m of pending) byId.set(m.id, m);
  const next = Array.from(byId.values()).sort(
    (a, b) => parseMessageDate(a.createdAt).getTime() - parseMessageDate(b.createdAt).getTime(),
  );
  return { next, olderCount: older.length, tailLen };
}
