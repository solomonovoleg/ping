import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PulseProfileCoverMedia } from "./PulseProfileCoverMedia";
import { PulseProfileCoverNavButtons } from "./PulseProfileCoverNavButtons";
import { PulseProfileCoverUsernamePill } from "./PulseProfileCoverUsernamePill";
import { PulseProfileCoverVignette } from "./PulseProfileCoverVignette";

/** Обложка без фильтров и «киношных» оверлеев — только фото (или плейсхолдер) и кнопки. */
export function PulseProfileCoverHeader({
  coverUrl,
  onCoverError,
  scrollY,
  usernamePill,
  onUsernamePillPress,
  onBack,
  onMore,
}: {
  coverUrl: string | null;
  onCoverError: () => void;
  scrollY: number;
  usernamePill: string;
  onUsernamePillPress?: () => void;
  onBack: () => void;
  onMore: () => void;
}) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <div className="relative h-full w-full">
      <PulseProfileCoverMedia
        coverUrl={coverUrl}
        onCoverError={onCoverError}
        scrollY={scrollY}
        isDark={isDark}
        accent={th.accent}
      />
      <PulseProfileCoverVignette />
      <PulseProfileCoverUsernamePill usernamePill={usernamePill} onUsernamePillPress={onUsernamePillPress} />
      <PulseProfileCoverNavButtons onBack={onBack} onMore={onMore} />
    </div>
  );
}
