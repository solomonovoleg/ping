import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";

/** Полоса записи голоса: волна уровня, градиент, мягкое свечение, анимация появления */
export function RecordingStrip({
  durationSec,
  onStop,
  className,
}: {
  durationSec: number;
  onStop: () => void;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const m = Math.floor(durationSec / 60);
  const s = Math.floor(durationSec % 60);
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;
  const bars = 7;
  return (
    <motion.div
      className={cn(
        "chat-composer-recording-strip mb-2 overflow-hidden rounded-2xl border border-red-400/40 bg-gradient-to-r from-red-500/20 via-rose-500/15 to-red-600/25 dark:from-red-600/25 dark:via-rose-600/20 dark:to-red-700/30 shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)] dark:shadow-[0_0_28px_-4px_rgba(239,68,68,0.4)]",
        className,
      )}
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="flex items-center gap-3 py-3 px-4">
        <div className="flex items-end gap-0.5 h-5" aria-hidden>
          {Array.from({ length: bars }).map((_, i) => (
            <motion.span
              key={i}
              className="w-0.5 rounded-full bg-red-500 dark:bg-red-400 origin-bottom"
              animate={
                reduced
                  ? { scaleY: 0.6 }
                  : {
                      scaleY: [0.4, 0.9, 0.5, 0.85, 0.4],
                      transition: {
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.08,
                        ease: "easeInOut",
                      },
                    }
              }
              style={{ height: "100%" }}
            />
          ))}
        </div>
        <span className="relative flex h-3 w-3 flex-shrink-0" aria-hidden>
          {!reduced && (
            <motion.span
              className="absolute inset-0 rounded-full bg-red-500 dark:bg-red-400"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 dark:bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        </span>
        <span className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-300 min-w-[2.5rem]">
          {timeStr}
        </span>
        <TapScaleButton
          type="button"
          onClick={onStop}
          haptic
          className="ml-auto px-4 py-2 rounded-xl bg-red-500 dark:bg-red-600 text-white text-sm font-semibold shadow-[0_2px_10px_rgba(239,68,68,0.4)] hover:bg-red-600 dark:hover:bg-red-700 active:shadow-inner transition-colors"
          aria-label="Остановить запись"
        >
          Стоп
        </TapScaleButton>
      </div>
    </motion.div>
  );
}
