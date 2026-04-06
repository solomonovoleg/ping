import type { UpdateProfile } from "@shared/schema";

/** Собирает объект для `users.update().set()` из частичного профиля; пустые поля не попадают. */
export function buildUserProfileUpdatePatch(data: UpdateProfile): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  if (data.displayName !== undefined) update.displayName = data.displayName;
  if (data.surname !== undefined) update.surname = data.surname;
  if (data.nickname !== undefined) update.nickname = data.nickname;
  if (data.gender !== undefined) update.gender = data.gender;
  if (data.birthDate !== undefined) update.birthDate = data.birthDate;
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;
  if (data.hideFromSearch !== undefined) update.hideFromSearch = data.hideFromSearch;
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.coverUrl !== undefined) update.coverUrl = data.coverUrl;
  if (data.showCover !== undefined) update.showCover = data.showCover;
  if (data.profileLink !== undefined) update.profileLink = data.profileLink;
  if (data.city !== undefined) update.city = data.city;
  if (data.status !== undefined) update.status = data.status;
  if (data.pinnedPostId !== undefined) update.pinnedPostId = data.pinnedPostId;
  if (data.profileVisibility !== undefined) update.profileVisibility = data.profileVisibility;
  if (data.dmPolicy !== undefined) update.dmPolicy = data.dmPolicy;
  if (data.groupAddMePolicy !== undefined) update.groupAddMePolicy = data.groupAddMePolicy;
  if (data.showOnlineTo !== undefined) update.showOnlineTo = data.showOnlineTo;
  if (data.pushEnabled !== undefined) update.pushEnabled = data.pushEnabled;
  if (data.vibeEnabled !== undefined) update.vibeEnabled = data.vibeEnabled;
  if (data.vibeShareWithPartner !== undefined) update.vibeShareWithPartner = data.vibeShareWithPartner;
  if (data.referralLimit !== undefined) {
    const v = data.referralLimit;
    update.referralLimit = v == null ? null : v;
  }
  if (data.boardApiHubPrimeCode !== undefined) {
    const v = data.boardApiHubPrimeCode;
    update.boardApiHubPrimeCode =
      v == null || (typeof v === "string" && v.trim() === "") ? null : String(v).trim().slice(0, 64);
  }
  if (data.businessContactPhone !== undefined) {
    const v = data.businessContactPhone;
    update.businessContactPhone =
      v == null || (typeof v === "string" && v.trim() === "") ? null : String(v).trim().slice(0, 64);
  }
  if (data.businessAddress !== undefined) {
    const v = data.businessAddress;
    update.businessAddress =
      v == null || (typeof v === "string" && v.trim() === "") ? null : String(v).trim().slice(0, 300);
  }
  return update;
}
