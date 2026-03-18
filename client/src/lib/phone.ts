/**
 * Валидация и формат телефона на клиенте (как на сервере: +7 и 10 цифр).
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Из введённых цифр (до 10 после 7) собирает нормализованный номер или null. */
export function normalizePhoneFromDigits(digits: string): string | null {
  const d = digitsOnly(digits).slice(0, 10);
  if (d.length !== 10) return null;
  if (d[0] !== "9") return null;
  return "+7" + d;
}

/** Форматирование для отображения в поле: (999) 123-45-67 (без +7, префикс в UI). */
export function formatPhoneInput(digits: string): string {
  const d = digitsOnly(digits).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}

/** Полное отображение с +7 в одном поле: +7 (999) 123-45-67 */
export function formatPhoneWithPrefix(digits: string): string {
  const formatted = formatPhoneInput(digits);
  return formatted ? `+7 ${formatted}` : "+7 ";
}

/** Из строки ввода (цифры с возможными 8/7 в начале) вытащить до 10 цифр номера после 7. */
export function parseInputToDigits(input: string): string {
  let d = digitsOnly(input);
  if (d.startsWith("8") || d.startsWith("7")) d = d.slice(1);
  return d.slice(0, 10);
}
