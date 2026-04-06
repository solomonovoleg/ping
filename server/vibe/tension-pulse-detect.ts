import type { Message } from "@shared/schema";

/** Порог: не цепляем случайные двойные отправки */
export const TENSION_BURST_MIN_TEXT = 6;
/**
 * Макс. интервал между соседними из «хвоста» серии (мс).
 * Чуть больше 2 с — сетевые/БД задержки не срывают эффект.
 */
export const TENSION_BURST_MAX_GAP_MS = 2400;

type MsgRef = Pick<Message, "id" | "createdAt">;

export function messageStrictlyAfter(a: MsgRef, b: MsgRef): boolean {
  const ta = new Date(a.createdAt as string | Date).getTime();
  const tb = new Date(b.createdAt as string | Date).getTime();
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta > tb;
  return a.id > b.id;
}

/**
 * Последние `TENSION_BURST_MIN_TEXT` подряд текстовых от `senderId` (новые → старые: [0]=самый новый).
 * `null`, если серии нет или интервалы между соседними в окне слишком большие.
 */
export function findRapidTextBurstWindow(messages: Message[], senderId: string): Message[] | null {
  if (messages.length === 0) return null;
  const run: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.senderId !== senderId || m.type !== "text") break;
    run.push(m);
  }
  if (run.length < TENSION_BURST_MIN_TEXT) return null;
  const win = run.slice(0, TENSION_BURST_MIN_TEXT);
  for (let i = 0; i < win.length - 1; i++) {
    const newer = win[i]!;
    const older = win[i + 1]!;
    const tNew = new Date(newer.createdAt).getTime();
    const tOld = new Date(older.createdAt).getTime();
    const dt = tNew - tOld;
    if (!Number.isFinite(dt) || dt < 0 || dt > TENSION_BURST_MAX_GAP_MS) return null;
  }
  return win;
}

/**
 * Срабатывание импульса только если это целая новая «шестёрка» после предыдущего пика:
 * самое старое из текущего окна строго новее, чем самое новое сообщение из прошлого срабатывания.
 */
export function rapidBurstIsNewCycleAfterPulse(
  messages: Message[],
  senderId: string,
  lastPulseNewest: MsgRef | null,
): boolean {
  const win = findRapidTextBurstWindow(messages, senderId);
  if (!win) return false;
  if (!lastPulseNewest) return true;
  const oldestInCurrentWin = win[TENSION_BURST_MIN_TEXT - 1]!;
  return messageStrictlyAfter(oldestInCurrentWin, lastPulseNewest);
}

export function detectRapidTextBurst(messages: Message[], senderId: string): boolean {
  return findRapidTextBurstWindow(messages, senderId) !== null;
}
