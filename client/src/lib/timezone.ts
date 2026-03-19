/**
 * Форматирование времени в локальной зоне устройства.
 * Используем getHours/getMinutes — они всегда возвращают локальное время,
 * в отличие от Intl в WebView/Capacitor, где timezone может быть UTC.
 */
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

