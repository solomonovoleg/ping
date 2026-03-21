import { resolveUrl } from "@/lib/api-base";
import type { PublicProfile } from "@/lib/users";
import { userProfileRu } from "../i18n.ru";
import { formatBirthChip, formatGenderChip } from "../utils/format-chips";

type MeUserExt = {
  displayName?: string | null;
  surname?: string | null;
  nickname?: string | null;
  publicId?: number;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  showCover?: boolean;
  gender?: string | null;
  birthDate?: string | null;
  profileLink?: string | null;
};

export function deriveUserProfileLayoutFields({
  isMe,
  user,
  apiProfile,
  id,
  normalizedRouteId,
  coverLoadError,
}: {
  isMe: boolean;
  user: MeUserExt | null | undefined;
  apiProfile: PublicProfile | null;
  id: string;
  normalizedRouteId: string;
  coverLoadError: boolean;
}) {
  const displayName =
    isMe && user
      ? [user.displayName, user.surname].filter(Boolean).join(" ") || userProfileRu.profileTitleFallback
      : apiProfile
        ? [apiProfile.displayName, apiProfile.surname].filter(Boolean).join(" ") || `ID ${apiProfile.publicId}`
        : "";
  const nicknameForPill = ((isMe ? user?.nickname : apiProfile?.nickname) ?? "").trim().replace(/^@+/, "");
  const usernamePillText =
    nicknameForPill.length > 0 ? nicknameForPill : String((isMe ? user?.publicId : apiProfile?.publicId) ?? id);
  const avatarUrl = isMe ? user?.avatarUrl : apiProfile?.avatarUrl;
  const profileCoverUrl = isMe ? user?.coverUrl : apiProfile?.coverUrl;
  const isCoverEnabled = isMe ? user?.showCover !== false : (apiProfile as { showCover?: boolean })?.showCover !== false;
  const resolvedCoverUrl = profileCoverUrl ? resolveUrl(profileCoverUrl) : "";
  const hasCoverAsset = !!resolvedCoverUrl && !coverLoadError;
  const hasCover = isCoverEnabled && hasCoverAsset;

  const publicIdStr = String((isMe ? user?.publicId : apiProfile?.publicId) ?? normalizedRouteId);
  const genderChip = formatGenderChip(isMe ? user?.gender : apiProfile?.gender);
  const birthChip = isMe ? formatBirthChip(user?.birthDate) : null;
  const profileLinkRaw = isMe ? user?.profileLink : (apiProfile as { profileLink?: string | null })?.profileLink;
  const profileLinkTrim = profileLinkRaw?.trim() ?? "";
  const profileLinkHref =
    profileLinkTrim && (profileLinkTrim.startsWith("http://") || profileLinkTrim.startsWith("https://"))
      ? profileLinkTrim
      : profileLinkTrim
        ? `https://${profileLinkTrim}`
        : null;

  return {
    displayName,
    usernamePillText,
    avatarUrl,
    resolvedCoverUrl,
    hasCover,
    publicIdStr,
    genderChip,
    birthChip,
    profileLinkTrim,
    profileLinkHref,
  };
}
