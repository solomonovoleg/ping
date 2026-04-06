/**
 * Генерация пригласительных кодов — 4 цифры (удобно диктовать и вводить).
 * Ранее выдавались фразы; ввод фраз при регистрации по-прежнему поддерживается для старых кодов.
 */

/** Генерирует 4-значный цифровой код */
export function generateDigitsCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) {
    s += Math.floor(Math.random() * 10);
  }
  return s;
}

/** Новые коды всегда 4 цифры */
export function generateReferralCode(): string {
  return generateDigitsCode();
}

/** Нормализует ввод: для фраз — пробелы/дефисы и нижний регистр; для цифр — 4 цифры подряд */
export function normalizeReferralCodeInput(input: string): string {
  const trimmed = input.trim();
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length === 4) return onlyDigits;
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
