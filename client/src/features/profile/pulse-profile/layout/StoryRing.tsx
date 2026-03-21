import { PULSE_IG_GLOW, PULSE_IG_GRAD, usePulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_AVATAR_PX } from "./constants";

export function StoryRing({ size = PULSE_AVATAR_PX }: { size?: number }) {
  const { th } = usePulseProfileTheme();
  const r = size * 0.22;
  return (
    <>
      <div
        className="absolute"
        style={{
          inset: -3,
          zIndex: 1,
          borderRadius: r + 3,
          background: PULSE_IG_GRAD,
          boxShadow: PULSE_IG_GLOW,
        }}
      />
      <div className="absolute" style={{ inset: -1, zIndex: 2, borderRadius: r + 1, background: th.gapRing }} />
    </>
  );
}
