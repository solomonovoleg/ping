import type { User } from "@shared/schema";
import { storage } from "../storage";
import { normalizeReferralCodeInput } from "./code-generator";
import { getReferralProgramSettings } from "./settings";

function getInviterReferralLimit(
  inviter: { referralLimit?: number | null } | undefined,
  defaultInvites: number,
): number {
  const limit = inviter?.referralLimit;
  if (limit != null && limit >= 0) return limit;
  return defaultInvites;
}

export type SignupReferralValidation =
  | {
      ok: true;
      referral: {
        id: string;
        inviterUserId: string;
        expiresAt: Date;
        bypassInviterLimit: boolean;
      };
      inviter: User | undefined;
    }
  | { ok: false; message: string };

/**
 * Одна точка правды: проверка кода при регистрации и в GET /api/referrals/check.
 * Учитывает срок, maxUses/useCount и лимит пригласившего (как в POST /api/auth/register).
 */
export async function assertReferralValidForSignup(rawCode: unknown): Promise<SignupReferralValidation> {
  const code = normalizeReferralCodeInput(typeof rawCode === "string" ? rawCode : "");
  if (!code) {
    return { ok: false, message: "Введите пригласительный код. Регистрация только по приглашению." };
  }
  const referral = await storage.getReferralCodeByCode(code);
  if (!referral) {
    return {
      ok: false,
      message: "Код приглашения не найден, истёк или уже использован. Попросите новый код.",
    };
  }
  const inviter = await storage.getUser(referral.inviterUserId);
  const referralSettings = await getReferralProgramSettings();
  const isAdminInviter =
    inviter && ["admin", "moderator", "super_admin"].includes(inviter.platformRole ?? "user");
  const bypassLimit = referral.bypassInviterLimit === true;
  if (!isAdminInviter && !bypassLimit) {
    const limit = getInviterReferralLimit(inviter, referralSettings.defaultInvites);
    const usedCount = await storage.countReferralsByInviter(referral.inviterUserId);
    if (usedCount >= limit) {
      return { ok: false, message: "Пригласивший вас пользователь исчерпал лимит приглашений." };
    }
  }
  return { ok: true, referral, inviter };
}
