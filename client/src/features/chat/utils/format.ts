/**
 * Форматирование времени и дат в чате.
 * Используем parseServerTimestamp и formatTimeLocal — всегда локальное время устройства.
 */
import { formatTimeLocal, formatDateShortLocal, formatDateLongLocal, parseServerTimestamp } from "@/lib/timezone";

/** Парсит дату от API (сервер должен отправлять UTC в ISO). */
export function parseMessageDate(raw: string): Date {
  return parseServerTimestamp(raw);
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
