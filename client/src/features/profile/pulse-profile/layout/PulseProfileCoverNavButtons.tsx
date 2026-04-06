import { memo } from "react";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { PULSE_PROFILE_CARD_OVERLAP_PX, PULSE_PROFILE_COVER_HEIGHT_PX } from "./constants";

type Props = {
  onBack: () => void;
  onMore: () => void;
};

/** Ряд кнопок ~h-10 + запас, чтобы низ не заходил на «шов» с карточкой героя. */
const NAV_ROW_APPROX_PX = 44;
const SEAM_CLEARANCE_PX = 6;

export const PulseProfileCoverNavButtons = memo(function PulseProfileCoverNavButtons({ onBack, onMore }: Props) {
  const maxTopPx =
    PULSE_PROFILE_COVER_HEIGHT_PX - PULSE_PROFILE_CARD_OVERLAP_PX - NAV_ROW_APPROX_PX - SEAM_CLEARANCE_PX;

  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center justify-between px-4"
      style={{
        top: `min(calc(env(safe-area-inset-top, 0px) + 4px), ${maxTopPx}px)`,
      }}
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
  );
});
