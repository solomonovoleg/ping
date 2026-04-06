import { memo } from "react";
import type { buildPulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_AVATAR_PX } from "./constants";
import { PulseBusinessBadge } from "./PulseBusinessBadge";

type Th = ReturnType<typeof buildPulseProfileTheme>;

type Props = {
  displayName: string;
  showVerified: boolean;
  isBusinessApproved?: boolean;
  metaLine: string;
  th: Th;
};

export const PulseProfileHeroTitleBlock = memo(function PulseProfileHeroTitleBlock({
  displayName,
  showVerified,
  isBusinessApproved = false,
  metaLine,
  th,
}: Props) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col justify-center"
      style={{ minHeight: PULSE_AVATAR_PX }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <h1
          className="min-w-0 truncate"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: th.text,
            letterSpacing: "-0.025em",
            lineHeight: 1.15,
          }}
        >
          {displayName}
        </h1>
        {isBusinessApproved ? <PulseBusinessBadge compact /> : null}
        {showVerified ? (
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-full"
            style={{ width: 18, height: 18, background: th.accent }}
            aria-label="Подтверждённый профиль"
          >
            <span style={{ fontSize: 9.5, color: "white", fontWeight: 900 }}>✓</span>
          </div>
        ) : null}
      </div>
      {metaLine ? (
        <p
          style={{
            fontSize: 12.5,
            color: th.text,
            marginTop: 4,
            fontWeight: 400,
            letterSpacing: "0.01em",
            lineHeight: 1.35,
            opacity: 0.88,
          }}
        >
          {metaLine}
        </p>
      ) : null}
    </div>
  );
});
