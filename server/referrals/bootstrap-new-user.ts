import { storage } from "../storage";
import { generateReferralCode } from "./code-generator";
import { getReferralProgramSettings } from "./settings";

const CODE_TTL_HOURS = 12;
const DEFAULT_INITIAL_CODES_COUNT = 3;

async function tryCreateOneDigitCode(userId: string, expiresAt: Date): Promise<boolean> {
  for (let attempt = 0; attempt < 16; attempt++) {
    let code = generateReferralCode();
    let inner = 0;
    while (inner < 6) {
      const clash = await storage.getReferralCodeByCode(code);
      if (!clash) break;
      code = generateReferralCode();
      inner++;
    }
    try {
      await storage.createReferralCode(userId, code, expiresAt);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|23505/i.test(msg)) continue;
      console.error("[referrals/bootstrap-new-user] createReferralCode:", e);
      return false;
    }
  }
  return false;
}

/**
 * После регистрации создаёт три активных цифровых кода (как три слота приглашений),
 * чтобы экран «Как пригласить друзей» не был пустым.
 * Ошибки только логируем — регистрация уже успешна.
 */
export async function bootstrapReferralCodeForNewUser(userId: string): Promise<void> {
  const settings = await getReferralProgramSettings();
  const initialCodesCount = Math.min(50, Math.max(1, settings.defaultInvites || DEFAULT_INITIAL_CODES_COUNT));
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + CODE_TTL_HOURS);

  let created = 0;
  for (let i = 0; i < initialCodesCount; i++) {
    const ok = await tryCreateOneDigitCode(userId, expiresAt);
    if (ok) created++;
    else break;
  }
  if (created < initialCodesCount) {
    console.warn(
      `[referrals/bootstrap-new-user] создано кодов: ${created}/${initialCodesCount} (остальные можно добавить вручную)`,
    );
  }
}
