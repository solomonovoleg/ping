import { storage } from "../storage";
import {
  getReferralAutoGrantState,
  getReferralProgramSettings,
  markReferralBonusGranted,
  setReferralFirstLimitReachedAt,
  type ReferralProgramSettings,
} from "./settings";

export type ReferralAutoGrantInfo = {
  firstLimitReachedAt: Date | null;
  bonusGrantedAt: Date | null;
  nextGrantAt: Date | null;
  repeatEnabled: boolean;
  repeatInvites: number;
  repeatAfterHours: number;
};

export type ReferralLimitSnapshot = {
  limit: number;
  settings: ReferralProgramSettings;
  auto: ReferralAutoGrantInfo;
};

function userLimitOrDefault(value: number | null | undefined, fallback: number): number {
  return value != null && value >= 0 ? value : fallback;
}

export async function getReferralLimitSnapshot(userId: string): Promise<ReferralLimitSnapshot> {
  const settings = await getReferralProgramSettings();
  const user = await storage.getUser(userId);
  const usedCount = await storage.countReferralsByInviter(userId);
  const state = await getReferralAutoGrantState(userId);

  let firstLimitReachedAt = state.firstLimitReachedAt;
  let bonusGrantedAt = state.bonusGrantedAt;
  let effectiveLimit = userLimitOrDefault(user?.referralLimit, settings.defaultInvites);
  let nextGrantAt: Date | null = null;

  if (firstLimitReachedAt == null && usedCount >= settings.defaultInvites) {
    const now = new Date();
    await setReferralFirstLimitReachedAt(userId, now);
    firstLimitReachedAt = now;
  }

  if (settings.repeatEnabled && firstLimitReachedAt != null && bonusGrantedAt == null) {
    nextGrantAt = new Date(firstLimitReachedAt.getTime() + settings.repeatAfterHours * 3_600_000);
    if (Date.now() >= nextGrantAt.getTime()) {
      const now = new Date();
      effectiveLimit += settings.repeatInvites;
      await storage.updateUserProfile(userId, { referralLimit: effectiveLimit });
      await markReferralBonusGranted(userId, now);
      bonusGrantedAt = now;
      nextGrantAt = null;
    }
  }

  return {
    limit: effectiveLimit,
    settings,
    auto: {
      firstLimitReachedAt,
      bonusGrantedAt,
      nextGrantAt,
      repeatEnabled: settings.repeatEnabled,
      repeatInvites: settings.repeatInvites,
      repeatAfterHours: settings.repeatAfterHours,
    },
  };
}
