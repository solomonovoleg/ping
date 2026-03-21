import { AtSign, ChevronLeft, MoreHorizontal } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
/** Обложка без фильтров и «киношных» оверлеев — только фото (или плейсхолдер) и кнопки. */
export function PulseProfileCoverHeader({
  coverUrl,
  onCoverError,
  scrollY,
  usernamePill,
  onBack,
  onMore,
}: {
  coverUrl: string | null;
  onCoverError: () => void;
  scrollY: number;
  usernamePill: string;
  onBack: () => void;
  onMore: () => void;
}) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="absolute w-full"
            style={{
              objectFit: "cover",
              objectPosition: "center 30%",
              height: "calc(100% + 56px)",
              top: -28,
              transform: `translateY(${Math.min(scrollY * 0.38, 28)}px)`,
              willChange: "transform",
            }}
            onError={onCoverError}
          />
        ) : (
          <div
            className="absolute w-full"
            style={{
              height: "calc(100% + 56px)",
              top: -28,
              transform: `translateY(${Math.min(scrollY * 0.38, 28)}px)`,
              willChange: "transform",
              background: isDark
                ? `radial-gradient(ellipse 80% 120% at 50% 20%, ${th.accent}35 0%, #0a0a18 55%)`
                : `radial-gradient(ellipse 80% 120% at 50% 20%, ${th.accent}28 0%, #e8ecfb 55%)`,
            }}
          />
        )}
      </div>

      <div
        className="pointer-events-none absolute left-0 right-0 z-20 flex justify-center"
        style={{ top: "max(10px, env(safe-area-inset-top, 0px))" }}
      >
        <div
          className="pointer-events-none flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
          style={{
            background: "rgba(0,0,0,0.48)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 2px 20px rgba(0,0,0,0.45)",
          }}
        >
          <AtSign style={{ width: 11, height: 11, color: "rgba(255,255,255,0.5)" }} aria-hidden />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "rgba(255,255,255,0.88)",
              letterSpacing: "0.01em",
            }}
          >
            {usernamePill}
          </span>
        </div>
      </div>

      <div
        className="absolute left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ top: "max(44px, calc(env(safe-area-inset-top, 0px) + 36px))" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full transition-colors hover:bg-white/10"
          aria-label="Назад"
        >
          <ChevronLeft style={{ width: 22, height: 22, color: "rgba(255,255,255,0.9)" }} />
        </button>
        <button
          type="button"
          onClick={onMore}
          className="flex h-10 w-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full transition-colors hover:bg-white/10"
          aria-label="Ещё"
        >
          <MoreHorizontal style={{ width: 20, height: 20, color: "rgba(255,255,255,0.9)" }} />
        </button>
      </div>
    </div>
  );
}
