import type { ReactNode } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { PULSE_IG_GRAD, usePulseProfileTheme } from "./pulse-profile-theme";

/** Шапка карточки поста в ленте профиля PULSE (как в макете: кольцо, имя, галочка, «Видео · 2 дн»). */
export function PulseProfileThemedPostCard({
  displayName,
  avatarUrl,
  authorSeed,
  showVerified,
  metaLine,
  headerRight,
  children,
}: {
  displayName: string;
  avatarUrl?: string | null;
  authorSeed: string;
  showVerified?: boolean;
  metaLine: string;
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <article
      className="relative overflow-hidden"
      style={{
        background: th.postBg,
        border: `1px solid ${th.postBorder}`,
        borderRadius: 18,
        padding: "14px 14px 12px",
        marginLeft: 8,
        marginRight: 8,
        marginBottom: 10,
        boxShadow: isDark ? "0 2px 14px rgba(0,0,0,0.35)" : "0 2px 12px rgba(99,102,241,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
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
            <div className="flex items-center gap-1.5">
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
            </div>
            <p className="mt-0.5 truncate font-medium" style={{ fontSize: 12, color: th.textFaint }}>
              {metaLine}
            </p>
          </div>
        </div>
        {headerRight ? (
          <div className="flex shrink-0 items-start gap-0.5 pt-0.5 [&_svg]:text-current" style={{ color: th.textSub }}>
            {headerRight}
          </div>
        ) : null}
      </div>
      {children}
    </article>
  );
}
