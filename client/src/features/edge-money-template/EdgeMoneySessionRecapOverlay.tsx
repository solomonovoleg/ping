import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { playEdgeMoneyRecapChime } from "@/lib/edge-money-recap-sound";
import type { EdgeMoneyRecapLine } from "./edge-money-visit-snapshot";

type Props = {
  open: boolean;
  lines: EdgeMoneyRecapLine[];
  totalDelta: number;
  onDismiss: () => void;
};

export function EdgeMoneySessionRecapOverlay({ open, lines, totalDelta, onDismiss }: Props) {
  const reduced = usePrefersReducedMotion();
  const playedRef = useRef(false);

  useEffect(() => {
    if (!open || lines.length === 0) {
      playedRef.current = false;
      return;
    }
    if (playedRef.current) return;
    playedRef.current = true;
    playEdgeMoneyRecapChime();
  }, [open, lines.length]);

  return (
    <AnimatePresence>
      {open && lines.length > 0 ? (
        <motion.div
          key="edge-money-recap"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edge-money-recap-title"
          className="absolute inset-0 z-[60] flex items-center justify-center p-4"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduced ? 0.05 : DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
        >
          <motion.button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/72 backdrop-blur-[2px]"
            initial={{ opacity: reduced ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: reduced ? 1 : 0 }}
            onClick={onDismiss}
          />
          <motion.div
            className="relative z-10 w-full max-w-[340px] overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#0c0e14]/95 p-5 shadow-2xl shadow-black/50"
            initial={reduced ? false : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
            transition={
              reduced
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 32, mass: 0.85 }
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10"
                style={{ backgroundColor: "color-mix(in srgb, var(--emoney-accent) 22%, transparent)" }}
              >
                <Coins className="h-6 w-6 text-[#facc15]" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 id="edge-money-recap-title" className="text-lg font-black leading-tight text-white">
                  С прошлого входа
                </h2>
                <p className="text-xs text-white/55">Начисления в рейтинг кампании</p>
              </div>
            </div>

            {totalDelta > 0 ? (
              <p className="mb-3 text-center text-2xl font-black tabular-nums text-[#facc15]">
                +{totalDelta} <span className="text-base font-bold text-white/80">балл.</span>
              </p>
            ) : null}

            <ul className="mb-5 max-h-[min(42dvh,280px)] space-y-2 overflow-y-auto pr-1 text-sm">
              {lines.map((l, i) => (
                <motion.li
                  key={`${l.label}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  initial={reduced ? false : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: reduced ? 0 : 0.06 + i * 0.07,
                    duration: DURATION_NORMAL_S * 0.9,
                    ease: EASING_OUT_BEZIER,
                  }}
                >
                  <span className="min-w-0 flex-1 leading-snug text-white/85">{l.label}</span>
                  <span className="shrink-0 font-bold tabular-nums text-[#4ade80]">+{l.points}</span>
                </motion.li>
              ))}
            </ul>

            <TapScaleButton
              type="button"
              haptic
              className="h-12 w-full rounded-2xl text-base font-bold text-white shadow-lg emoney-accent-bg"
              onClick={onDismiss}
            >
              Понятно
            </TapScaleButton>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
