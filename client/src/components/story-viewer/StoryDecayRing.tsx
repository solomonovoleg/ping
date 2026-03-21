import { PULSE_ACCENT } from "./constants";

export function StoryDecayRing({ expiresAt }: { expiresAt: Date | null }) {
  const totalHours = 24;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const hoursLeftFloat = diffMs / 3600000;
  const frac = Math.min(1, diffMs / (totalHours * 3600000));
  const R = 16;
  const C = 2 * Math.PI * R;
  const urgent = frac < 0.25;
  const color = urgent ? "#ef4444" : frac < 0.5 ? "#fbbf24" : PULSE_ACCENT;
  const centerLabel =
    hoursLeftFloat >= 1
      ? `${Math.max(1, Math.ceil(hoursLeftFloat))}ч`
      : `${Math.max(1, Math.ceil(diffMs / 60000))}м`;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: 38, height: 38 }}
      role="img"
      aria-label={`До удаления сториз осталось ${centerLabel}`}
    >
      <svg
        width="38"
        height="38"
        className="absolute inset-0"
        style={{ transform: "rotate(-90deg)" }}
        aria-hidden
      >
        <circle cx="19" cy="19" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
        <circle
          cx="19"
          cy="19"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.4s ease" }}
        />
      </svg>
      <span
        className="relative z-10 font-extrabold tracking-tight"
        style={{ fontSize: 9, color, lineHeight: 1 }}
      >
        {centerLabel}
      </span>
    </div>
  );
}
