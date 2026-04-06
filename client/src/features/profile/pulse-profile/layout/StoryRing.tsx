import { PULSE_IG_GLOW, PULSE_IG_GRAD, usePulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_AVATAR_PX } from "./constants";

export function StoryRing({ size = PULSE_AVATAR_PX }: { size?: number }) {
  const { th } = usePulseProfileTheme();
  const r = size * 0.22;
  const outerInset = Math.max(3, Math.round(size * 0.055));
  const innerGapInset = Math.max(1, Math.round(size * 0.02));
  return (
    <>
      <div
        className="absolute"
        style={{
          inset: -outerInset,
          zIndex: 1,
          borderRadius: r + outerInset,
          background: PULSE_IG_GRAD,
          boxShadow: PULSE_IG_GLOW,
        }}
      />
      <div
        className="absolute"
        style={{
          inset: -innerGapInset,
          zIndex: 2,
          borderRadius: r + innerGapInset,
          background: th.gapRing,
        }}
      />
    </>
  );
}
