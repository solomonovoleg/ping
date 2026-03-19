/**
 * Утилиты времени: локальная зона клиента.
 * Используем getHours/getMinutes/getDate — они всегда возвращают локальное время устройства,
 * в отличие от Intl в WebView/Capacitor, где timezone может быть UTC.
 */

/** Текущее время клиента (локальная зона). */
export function getClientNow(): Date {
  return new Date();
}

/** Парсит ISO-строку от сервера. Сервер должен отправлять UTC (с Z или +offset). */
export function parseServerTimestamp(iso: string): Date {
  if (!iso || typeof iso !== "string") return new Date(NaN);
  const value = iso.trim();
  const hasExplicitTz = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (hasExplicitTz) return new Date(value);
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized)) {
    return new Date(`${normalized}Z`);
  }
  return new Date(value);
}

export function formatTimeLocal(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Короткая дата (день, месяц) в локальной зоне — через getDate/getMonth */
export function formatDateShortLocal(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth();
  const months = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
  return `${d} ${months[m]}`;
}

export function formatDateLongLocal(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth();
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  return `${d} ${months[m]}`;
}

/** Дата с годом (день месяц год) */
export function formatDateWithYearLocal(date: Date): string {
  const d = date.getDate();
  const m = date.getMonth();
  const y = date.getFullYear();
  const months = ["янв.", "февр.", "марта", "апр.", "мая", "июня", "июля", "авг.", "сент.", "окт.", "нояб.", "дек."];
  return `${d} ${months[m]} ${y}`;
}

/** Опции для toLocaleTimeString (fallback, когда Intl работает) */
export function getTimeFormatOptions(): { hour: "2-digit"; minute: "2-digit"; timeZone?: string } {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { hour: "2-digit", minute: "2-digit", ...(tz !== "UTC" && tz && { timeZone: tz }) };
}

/** Опции для toLocaleDateString (fallback) */
export function getDateFormatOptions(
  opts: { day?: "numeric"; month?: "short" | "long"; year?: "numeric" } = { day: "numeric", month: "short" }
): { day?: "numeric"; month?: "short" | "long"; year?: "numeric"; timeZone?: string } {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return { ...opts, ...(tz !== "UTC" && tz && { timeZone: tz }) };
}

/**
 * Сравнивает время клиента с сервером (для отладки).
 * Возвращает разницу в мс: положительная = клиент впереди.
 */
export async function getClientServerTimeDiff(): Promise<number> {
  const { API } = await import("@/lib/api-base");
  const clientBefore = Date.now();
  const res = await fetch(`${API}/time`, { cache: "no-store", credentials: "include" });
  const clientAfter = Date.now();
  const data = (await res.json()) as { serverTimeMs: number };
  const rtt = clientAfter - clientBefore;
  const serverTime = data.serverTimeMs;
  const clientMid = clientBefore + rtt / 2;
  return clientMid - serverTime;
}

