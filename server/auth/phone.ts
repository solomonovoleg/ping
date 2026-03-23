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
 * Все варианты полного номера в формате +7… из произвольной строки поиска.
 * Учитывает пробелы, скобки, дефисы («8900-700-9094»), префиксы 8/7/+7, 10 цифр с 9.
 * Неполные номера (+7900, 900…) не возвращаются — только то, что проходит normalizePhone.
 */
export function normalizedPhonesFromSearchQuery(input: string | null | undefined): string[] {
  if (input == null || typeof input !== "string") return [];
  const trimmed = input.trim();
  if (!trimmed) return [];

  const out = new Set<string>();
  const add = (n: string | null) => {
    if (n) out.add(n);
  };

  add(normalizePhone(trimmed));

  for (const seg of trimmed.split(/\D+/).filter(Boolean)) {
    const d = seg.replace(/\D/g, "");
    if (d.length >= 10 && d.length <= 11) add(normalizePhone(d));
  }

  const allDigits = trimmed.replace(/\D/g, "");
  if (allDigits.length >= 10) {
    for (const len of [10, 11] as const) {
      if (allDigits.length < len) continue;
      for (let i = 0; i <= allDigits.length - len; i++) {
        add(normalizePhone(allDigits.slice(i, i + len)));
      }
    }
  }

  return [...out];
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
