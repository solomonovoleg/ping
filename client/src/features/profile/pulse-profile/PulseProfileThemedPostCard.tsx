import type { ReactNode } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { PULSE_IG_GRAD, usePulseProfileTheme } from "./pulse-profile-theme";

/** Карточка поста в ленте профиля PULSE: шапка с отступами, медиа на всю ширину, подвал с отступами. */
export function PulseProfileThemedPostCard({
  displayName,
  avatarUrl,
  authorSeed,
  showVerified,
  metaKind,
  metaTime,
  headerRight,
  children,
}: {
  displayName: string;
  avatarUrl?: string | null;
  authorSeed: string;
  showVerified?: boolean;
  /** «Видео» / «Фото» — в одной строке с именем после «·». */
  metaKind: string | null;
  /** Время, отдельной строкой под именем. */
  metaTime: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <article
      className="relative w-full overflow-hidden"
      style={{
        background: th.postBg,
        borderBottom: `1px solid ${th.postBorder}`,
        boxShadow: isDark ? "0 1px 0 rgba(0,0,0,0.2)" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="relative h-10 w-10 shrink-0">
            <div
              className="absolute rounded-[14px]"
              style={{
                inset: -2,
                background: PULSE_IG_GRAD,
                opacity: 0.92,
                boxShadow: "0 0 10px rgba(214,41,118,0.25)",
              }}
            />
            <div
              className="relative h-full w-full overflow-hidden rounded-xl"
              style={{ background: th.bg, boxShadow: `inset 0 0 0 1px ${th.border}` }}
            >
              <UserAvatar
                avatarUrl={avatarUrl ?? undefined}
                displayName={displayName}
                seed={authorSeed}
                size={36}
                className="h-full w-full rounded-[12px] object-cover"
              />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <h3
                className="truncate font-bold leading-tight"
                style={{ fontSize: 15, color: th.text, letterSpacing: "-0.02em" }}
              >
                {displayName}
              </h3>
              {showVerified ? (
                <div
                  className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: th.accent, marginTop: 1 }}
                  aria-label="Подтверждённый профиль"
                >
                  <span className="text-[9px] font-extrabold text-white">✓</span>
                </div>
              ) : null}
              {metaKind ? (
                <>
                  <span style={{ fontSize: 15, color: th.text, opacity: 0.45 }} aria-hidden>
                    ·
                  </span>
                  <span className="shrink-0 font-medium" style={{ fontSize: 14, color: th.text }}>
                    {metaKind}
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-0.5 truncate font-normal" style={{ fontSize: 12, color: th.text, opacity: 0.55 }}>
              {metaTime}
            </p>
          </div>
        </div>
        {headerRight ? (
          <div className="flex shrink-0 items-start gap-0.5 pt-0.5 [&_svg]:text-current" style={{ color: th.text }}>
            {headerRight}
          </div>
        ) : null}
      </div>
      {children}
    </article>
  );
}
