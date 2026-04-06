/**
 * Форматирование времени и дат в чате.
 * Используем parseServerTimestamp и formatTimeLocal — всегда локальное время устройства.
 */
import type { ClientOutgoingSendStatus } from "@shared/message-delivery-status";
import { formatTimeLocal, formatDateShortLocal, formatDateLongLocal, parseServerTimestamp } from "@/lib/timezone";

/** Парсит дату от API (сервер должен отправлять UTC в ISO). */
export function parseMessageDate(raw: string): Date {
  return parseServerTimestamp(raw);
}

/** Допуск при сравнении времени сообщения и last_read собеседника (мс в JSON/БД могут отличаться). */
const READ_RECEIPT_TIME_EPSILON_MS = 2500;

/**
 * Две галочки у исходящих: только если у собеседника на сервере last_read ≥ времени сообщения.
 * Не путать с «в сети» / last_seen — для статуса в шапке используется {@link formatLastSeen}.
 */
export function isOutgoingMessageReadByPeer(
  messageCreatedAtIso: string,
  peerLastReadAtIso: string | null | undefined,
): boolean {
  if (peerLastReadAtIso == null || peerLastReadAtIso === "") return false;
  const msgT = parseMessageDate(messageCreatedAtIso).getTime();
  const readT = parseMessageDate(peerLastReadAtIso).getTime();
  if (!Number.isFinite(msgT) || !Number.isFinite(readT)) return false;
  return msgT <= readT + READ_RECEIPT_TIME_EPSILON_MS;
}

export function formatMessageTime(iso: string): string {
  const d = parseMessageDate(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const time = formatTimeLocal(d);
  if (diff < 86400000) return time;
  if (diff < 172800000) return "Вчера " + time;
  return formatDateShortLocal(d) + " " + time;
}

export function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = parseMessageDate(iso);
  const now = new Date();
  const diffMin = (now.getTime() - d.getTime()) / 60000;
  if (diffMin < 2) return "в сети";
  if (diffMin < 60) return "был(а) недавно";
  if (diffMin < 1440) return `был(а) в ${formatTimeLocal(d)}`;
  if (diffMin < 2880) return "был(а) вчера";
  return `был(а) ${formatDateShortLocal(d)}`;
}

export function getDateSectionLabel(iso: string): string {
  const d = parseMessageDate(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const t = d.getTime();
  if (t >= startOfToday) return "Сегодня";
  if (t >= startOfYesterday) return "Вчера";
  return formatDateLongLocal(d);
}

export function toDateKey(iso: string): string {
  const d = parseMessageDate(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Подсказка у галочек исходящего: одна галочка = доставлено, две = прочитано собеседником. */
export function outgoingDeliveryTitle(
  isReadByPeer: boolean,
  peerLastReadAtIso: string | null | undefined,
  sendStatus?: ClientOutgoingSendStatus | null,
): string {
  if (isReadByPeer && peerLastReadAtIso) {
    return `Прочитано · ${formatMessageTime(peerLastReadAtIso)}`;
  }
  return "Доставлено";
}

export function outgoingDeliveryAriaLabel(
  isReadByPeer: boolean,
  peerLastReadAtIso: string | null | undefined,
  sendStatus?: ClientOutgoingSendStatus | null,
): string {
  if (sendStatus === "sending") return "Отправляется";
  if (sendStatus === "failed") return "Ошибка отправки";
  if (isReadByPeer && peerLastReadAtIso) return `Прочитано ${formatMessageTime(peerLastReadAtIso)}`;
  return "Доставлено";
}

/** Компактная строка под PULSE-видеокружок: время + галочки (без дубля с нижним футером строки). */
export function outgoingDeliveryPulseFooterLabel(
  messageCreatedAtIso: string,
  isReadByPeer: boolean,
  sendStatus?: ClientOutgoingSendStatus | null,
): string | null {
  if (sendStatus === "sending" || sendStatus === "failed") return null;
  const t = formatMessageTime(messageCreatedAtIso);
  return isReadByPeer ? `${t} ✓✓` : `${t} ✓`;
}

/** Доступное описание времени у входящего сообщения в футере пузыря. */
export function incomingMessageFooterAria(messageCreatedAtIso: string): string {
  return `Время сообщения ${formatMessageTime(messageCreatedAtIso)}`;
}
