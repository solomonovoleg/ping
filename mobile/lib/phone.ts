/**
 * Как в веб-версии (client/src/lib/phone.ts): только 10 цифр с 9, отображение +7.
 */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Из введённых цифр (8/7 в начале убираем) — до 10 цифр номера. */
export function parseInputToDigits(input: string): string {
  let d = digitsOnly(input);
  if (d.startsWith("8") || d.startsWith("7")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Нормализованный номер для API: +7 и 10 цифр, или null. */
export function normalizePhoneFromDigits(digits: string): string | null {
  const d = digitsOnly(digits).slice(0, 10);
  if (d.length !== 10) return null;
  if (d[0] !== "9") return null;
  return "+7" + d;
}

/** Для отображения в поле: +7 (999) 123-45-67. Пусто → "+7 " как на вебе. */
export function formatPhoneWithPrefix(digits: string): string {
  const d = parseInputToDigits(digits);
  if (d.length === 0) return "+7 ";
  if (d.length <= 3) return "+7 " + d;
  if (d.length <= 6) return `+7 (${d.slice(0, 3)}) ${d.slice(3)}`;
  return `+7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}
