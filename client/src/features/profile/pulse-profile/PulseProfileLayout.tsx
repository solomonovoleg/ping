import { PulseProfileThemeProvider } from "./pulse-profile-theme";
import { usePulseProfileThemeFromDocument } from "./usePulseProfileThemeFromDocument";
import {
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
  PULSE_PROFILE_COVER_HEIGHT_PX,
  PULSE_PROFILE_NAV_CONTENT_PB,
  PULSE_PROFILE_SCROLL_BODY_PADDING_TOP_PX,
} from "./layout/constants";
import { PulseProfileCoverHeader } from "./layout/PulseProfileCoverHeader";
import { PulseProfileAddContentStrip } from "./layout/PulseProfileAddContentStrip";
import { PulseProfileHighlightTile } from "./layout/PulseProfileHighlightTile";
import { PulseProfileIconButton } from "./layout/PulseProfileIconButton";
import { PulseProfileLayoutInner } from "./layout/PulseProfileLayoutInner";
import type { PulseProfileLayoutProps } from "./layout/types";

export type { PulseProfileLayoutProps, PulseProfileMutualFollowersModel, PulseProfileTabKey } from "./layout/types";

export {
  PULSE_PROFILE_NAV_CONTENT_PB,
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
  PULSE_PROFILE_COVER_HEIGHT_PX,
  PULSE_PROFILE_SCROLL_BODY_PADDING_TOP_PX,
  PulseProfileCoverHeader,
  PulseProfileHighlightTile,
  PulseProfileAddContentStrip,
  PulseProfileIconButton,
};

/** Оболочка профиля PULSE (экспорт `pulse-profile-export` / MobileProfile), без нижней навигации приложения. */
export function PulseProfileLayout(props: PulseProfileLayoutProps) {
  const docTheme = usePulseProfileThemeFromDocument();
  const { themeMode, ...innerProps } = props;
  return (
    <PulseProfileThemeProvider theme={themeMode ?? docTheme}>
      <PulseProfileLayoutInner {...innerProps} />
    </PulseProfileThemeProvider>
  );
}
