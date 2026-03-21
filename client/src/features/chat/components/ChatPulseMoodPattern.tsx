import { useId, type CSSProperties } from "react";
import type { VibeThemeCode } from "@shared/chat-vibe-types";

type Props = {
  theme: VibeThemeCode;
  accentColor: string;
  /** Светлая подложка чата — нейтральные штрихи вместо белых */
  isDarkSurface: boolean;
  reducedMotion: boolean;
};

const KEYFRAMES = `
@keyframes chatPulsePatDrift1 { from { transform: translate(0,0); } to { transform: translate(36px,36px); } }
@keyframes chatPulsePatDrift2 { from { transform: translate(0,0); } to { transform: translate(-24px,24px); } }
@keyframes chatPulsePatDrift3 { from { transform: translate(0,0); } to { transform: translate(48px,-24px); } }
`;

const baseLayer = (): CSSProperties => ({
  position: "absolute",
  top: "-15%",
  left: "-15%",
  width: "130%",
  height: "130%",
  overflow: "visible",
  pointerEvents: "none",
});

/**
 * Тонкие SVG-паттерны фона чата в духе PULSE MobileChat (MoodPattern).
 */
export function ChatPulseMoodPattern({ theme, accentColor, isDarkSurface, reducedMotion }: Props) {
  const uid = useId().replace(/:/g, "");
  const lineMuted = isDarkSurface ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.35)";
  const dotMuted = isDarkSurface ? "rgba(255,255,255,1)" : "rgba(15,23,42,0.4)";
  const anim = (name: string, durationSec: number) =>
    reducedMotion ? undefined : `${name} ${durationSec}s linear infinite`;

  const id = `p-${uid}-${theme}`;

  const casual = (
    <>
      <svg
        style={{
          ...baseLayer(),
          opacity: isDarkSurface ? 0.045 : 0.06,
          animation: anim("chatPulsePatDrift1", 40),
        }}
        aria-hidden
      >
        <defs>
          <pattern id={`${id}-h`} width="36" height="36" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="36" y2="36" stroke={lineMuted} strokeWidth="0.6" />
            <line x1="36" y1="0" x2="0" y2="36" stroke={lineMuted} strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-h)`} />
      </svg>
      <svg
        style={{
          ...baseLayer(),
          opacity: isDarkSurface ? 0.055 : 0.07,
          animation: anim("chatPulsePatDrift3", 55),
        }}
        aria-hidden
      >
        <defs>
          <pattern id={`${id}-d`} width="48" height="48" patternUnits="userSpaceOnUse">
            <circle cx="24" cy="24" r="1.2" fill={dotMuted} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-d)`} />
      </svg>
    </>
  );

  const romantic = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.1,
        animation: anim("chatPulsePatDrift2", 34),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="80" height="80" patternUnits="userSpaceOnUse">
          <path
            d="M40,14 C55,4 76,18 40,46 C4,18 25,4 40,14Z"
            fill="none"
            stroke={accentColor}
            strokeWidth="1"
          />
          <path d="M40,14 C55,4 76,18 40,46 C4,18 25,4 40,14Z" fill={accentColor} opacity="0.04" />
          <circle cx="40" cy="64" r="3" fill={accentColor} opacity="0.25" />
          <circle cx="12" cy="40" r="2" fill={accentColor} opacity="0.15" />
          <circle cx="68" cy="40" r="2" fill={accentColor} opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const business = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.065,
        animation: anim("chatPulsePatDrift3", 38),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="64" height="24" patternUnits="userSpaceOnUse">
          <line x1="0" y1="12" x2="64" y2="12" stroke={accentColor} strokeWidth="0.7" strokeDasharray="5 7" />
          <circle cx="0" cy="12" r="1.5" fill={accentColor} opacity="0.6" />
          <circle cx="64" cy="12" r="1.5" fill={accentColor} opacity="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const conflict = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.1,
        animation: anim("chatPulsePatDrift1", 18),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="44" height="66" patternUnits="userSpaceOnUse">
          <path
            d="M22,0 L44,22 L22,44 L44,66"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M0,0 L22,22 L0,44 L22,66"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const fun = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.11,
        animation: anim("chatPulsePatDrift2", 26),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="72" height="72" patternUnits="userSpaceOnUse">
          <circle cx="18" cy="18" r="6" fill="none" stroke={accentColor} strokeWidth="1.1" />
          <polygon points="54,8 64,26 44,26" fill="none" stroke={accentColor} strokeWidth="1.1" />
          <rect
            x="7"
            y="46"
            width="14"
            height="14"
            rx="3"
            fill="none"
            stroke={accentColor}
            strokeWidth="1.1"
            transform="rotate(18 14 53)"
          />
          <circle cx="58" cy="58" r="3.5" fill={accentColor} opacity="0.35" />
          <polygon points="38,50 46,65 30,65" fill={accentColor} opacity="0.12" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const relax = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.08,
        animation: anim("chatPulsePatDrift3", 40),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="130" height="45" patternUnits="userSpaceOnUse">
          <path
            d="M0,22 C22,8 43,36 65,22 C87,8 108,36 130,22"
            fill="none"
            stroke={accentColor}
            strokeWidth="1"
          />
          <path
            d="M0,32 C22,18 43,46 65,32 C87,18 108,46 130,32"
            fill="none"
            stroke={accentColor}
            strokeWidth="0.55"
            opacity="0.45"
          />
          <circle cx="65" cy="22" r="2.5" fill={accentColor} opacity="0.3" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const support = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.08,
        animation: anim("chatPulsePatDrift2", 32),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="74" height="74" patternUnits="userSpaceOnUse">
          <circle cx="37" cy="37" r="24" fill="none" stroke={accentColor} strokeWidth="0.9" />
          <circle cx="37" cy="37" r="14" fill="none" stroke={accentColor} strokeWidth="0.6" opacity="0.5" />
          <circle cx="62" cy="18" r="9" fill="none" stroke={accentColor} strokeWidth="0.6" opacity="0.3" />
          <circle cx="8" cy="62" r="6" fill="none" stroke={accentColor} strokeWidth="0.5" opacity="0.2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );

  const gaming = (
    <svg
      style={{
        ...baseLayer(),
        opacity: 0.09,
        animation: anim("chatPulsePatDrift1", 22),
      }}
      aria-hidden
    >
      <defs>
        <pattern id={id} width="34" height="34" patternUnits="userSpaceOnUse">
          <circle cx="17" cy="17" r="2" fill={accentColor} />
          <rect x="0.5" y="0.5" width="33" height="33" fill="none" stroke={accentColor} strokeWidth="0.3" opacity="0.25" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      {[0, 1, 2, 3].map((i) => (
        <rect
          key={i}
          x={`${12 + i * 22}%`}
          y={`${8 + (i % 2) * 28}%`}
          width="44"
          height="44"
          rx="5"
          fill="none"
          stroke={accentColor}
          strokeWidth="0.9"
          opacity="0.18"
        />
      ))}
    </svg>
  );

  const body =
    theme === "casual"
      ? casual
      : theme === "romantic"
        ? romantic
        : theme === "business"
          ? business
          : theme === "conflict"
            ? conflict
            : theme === "fun"
              ? fun
              : theme === "relax"
                ? relax
                : theme === "support"
                  ? support
                  : gaming;

  return (
    <>
      <style>{KEYFRAMES}</style>
      {body}
    </>
  );
}
