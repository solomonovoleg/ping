import type { IStorage } from "../storage/types";
import { normalizeReferralCodeInput } from "../referrals/code-generator";

const SEED_REVIEW_PHONE = "+79956012736";

export type AppStoreReviewReferralMatch =
  | { kind: "none" }
  | { kind: "ok"; invitedById: string }
  /** В .env задан ревью-код, пользователь его ввёл, но нет seed +79956012736 и ни одного админа */
  | { kind: "misconfigured" };

/**
 * Обход проверки БД для кода из `APP_STORE_REVIEW_REFERRAL_CODE` (App Store Review).
 * Приглашающий — seed-пользователь или первый админ; расход кода в `referral_codes` не ведётся.
 */
export async function matchAppStoreReviewReferralCode(
  storage: IStorage,
  rawCode: unknown,
  isBootstrap: boolean,
): Promise<AppStoreReviewReferralMatch> {
  if (isBootstrap) return { kind: "none" };
  const envRaw = process.env.APP_STORE_REVIEW_REFERRAL_CODE;
  const envCode = normalizeReferralCodeInput(typeof envRaw === "string" ? envRaw : "");
  if (!envCode) return { kind: "none" };
  const userCode = normalizeReferralCodeInput(typeof rawCode === "string" ? rawCode : "");
  if (userCode !== envCode) return { kind: "none" };

  const seed = await storage.getUserByPhone(SEED_REVIEW_PHONE);
  if (seed) return { kind: "ok", invitedById: seed.id };

  const admins = await storage.listAdmins();
  const first = admins[0];
  if (first) return { kind: "ok", invitedById: first.id };

  return { kind: "misconfigured" };
}

/** Для GET /api/referrals/check: показать ревью-код как валидный без строки в `referral_codes`. */
export async function publicCheckAppStoreReviewReferral(
  storage: IStorage,
  rawCode: string,
): Promise<{ inviterName: string; expiresAt: string } | null> {
  const match = await matchAppStoreReviewReferralCode(storage, rawCode, false);
  if (match.kind !== "ok") return null;
  const inv = await storage.getUser(match.invitedById);
  const inviterName =
    inv && (inv.displayName || inv.surname)
      ? [inv.displayName, inv.surname].filter(Boolean).join(" ").trim()
      : `ID ${inv?.publicId ?? ""}`;
  const expiresAt = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
  return { inviterName: inviterName || "Ping", expiresAt };
}
