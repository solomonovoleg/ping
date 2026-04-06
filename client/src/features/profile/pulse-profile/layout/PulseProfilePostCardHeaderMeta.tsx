import { memo } from "react";

type Props = {
  displayName: string;
  showVerified?: boolean;
  metaKind: string | null;
  metaTime: string;
  textColor: string;
  accent: string;
};

export const PulseProfilePostCardHeaderMeta = memo(function PulseProfilePostCardHeaderMeta({
  displayName,
  showVerified,
  metaKind,
  metaTime,
  textColor,
  accent,
}: Props) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <h3
          className="truncate font-bold leading-tight"
          style={{ fontSize: 15, color: textColor, letterSpacing: "-0.02em" }}
        >
          {displayName}
        </h3>
        {showVerified ? (
          <div
            className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full"
            style={{ background: accent, marginTop: 1 }}
            aria-label="Подтверждённый профиль"
          >
            <span className="text-[9px] font-extrabold text-white">✓</span>
          </div>
        ) : null}
        {metaKind ? (
          <>
            <span style={{ fontSize: 15, color: textColor, opacity: 0.45 }} aria-hidden>
              ·
            </span>
            <span className="shrink-0 font-medium" style={{ fontSize: 14, color: textColor }}>
              {metaKind}
            </span>
          </>
        ) : null}
      </div>
      <p className="mt-0.5 truncate font-normal" style={{ fontSize: 12, color: textColor, opacity: 0.55 }}>
        {metaTime}
      </p>
    </div>
  );
});
