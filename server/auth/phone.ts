/**
 * Нормализация и валидация российского номера телефона.
 * Формат на выходе: +7XXXXXXXXXX (7 + 10 цифр).
 */

const DIGITS_ONLY = /^\d+$/;
const RUSSIAN_PHONE_LEN = 11;
const RUSSIAN_COUNTRY_CODE = "7";

/**
 * Оставляет в строке только цифры.
 */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Нормализует ввод к формату +7XXXXXXXXXX.
 * Допускает: 8..., +7..., 7..., 10 цифр без кода.
 * Возвращает нормализованный номер или null при невалидном вводе.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null || typeof input !== "string") return null;
  const raw = digitsOnly(input.trim());
  if (raw.length === 0) return null;

  let code = raw;
  if (raw.length === 10 && raw.startsWith("9")) {
    code = RUSSIAN_COUNTRY_CODE + raw;
  } else if (raw.length === 11 && raw.startsWith("8")) {
    code = RUSSIAN_COUNTRY_CODE + raw.slice(1);
  } else if (raw.length === 11 && raw.startsWith("7")) {
    code = raw;
  } else if (raw.length === 10) {
    code = RUSSIAN_COUNTRY_CODE + raw;
  } else {
    return null;
  }

  if (code.length !== RUSSIAN_PHONE_LEN || code[0] !== "7") return null;
  if (!DIGITS_ONLY.test(code)) return null;

  return "+" + code;
}

/**
 * Форматирование для отображения: +7 (XXX) XXX-XX-XX.
 */
export function formatPhoneDisplay(phone: string): string {
  const d = digitsOnly(phone);
  if (d.length !== 11 || d[0] !== "7") return phone;
  const a = d.slice(1, 4);
  const b = d.slice(4, 7);
  const c = d.slice(7, 9);
  const e = d.slice(9, 11);
  return `+7 (${a}) ${b}-${c}-${e}`;
}
