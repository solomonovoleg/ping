/**
 * Генерация пригласительных кодов — простые русские словосочетания (например «дом моды»).
 * Удобно диктовать и вводить вручную.
 */

/** Готовые короткие русские словосочетания — два слова */
const PHRASES = [
  "дом моды",
  "утренний кофе",
  "летний вечер",
  "тихий час",
  "морской ветер",
  "город огней",
  "звёздная ночь",
  "первый снег",
  "ясный день",
  "тёплый дождь",
  "сладкий сон",
  "голубой экран",
  "красный конь",
  "белый парус",
  "золотой час",
  "новый год",
  "добрый вечер",
  "светлый путь",
  "дальний берег",
  "родной дом",
  "живой огонь",
  "чистый воздух",
  "высокий замок",
  "глубокий лес",
  "широкая река",
  "быстрый поезд",
  "тёмная ночь",
  "светлая мысль",
  "горячий чай",
  "холодный лёд",
];

const SEP = "-";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Генерирует код — русское словосочетание (слова через дефис для хранения) */
export function generatePhraseCode(): string {
  const phrase = pickRandom(PHRASES);
  return phrase.trim().toLowerCase().replace(/\s+/g, SEP);
}

/** Генерирует 4-значный цифровой код */
export function generateDigitsCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

/** Генерирует код: фраза или 4 цифры */
export function generateReferralCode(format: "phrase" | "digits" = "phrase"): string {
  return format === "digits" ? generateDigitsCode() : generatePhraseCode();
}

/** Нормализует ввод: для фраз — пробелы/дефисы и нижний регистр; для цифр — 4 цифры подряд */
export function normalizeReferralCodeInput(input: string): string {
  const trimmed = input.trim();
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length === 4) return onlyDigits;
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, SEP)
    .replace(/-+/g, SEP);
}
