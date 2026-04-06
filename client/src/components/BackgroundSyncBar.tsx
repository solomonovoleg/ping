import { motion } from "framer-motion";
import { EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = {
  active: boolean;
  className?: string;
  /** Для скринридеров */
  label?: string;
};

/** Тонкая полоса под шапкой при фоновом refetch (индикатор синхронизации). */
export function BackgroundSyncBar({ active, className, label = "Обновление данных" }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  if (!active) return null;
  return (
    <div
      className={cn("pointer-events-none relative h-0.5 w-full overflow-hidden bg-primary/20", className)}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {reducedMotion ? (
        <div className="h-full w-full bg-primary/45" />
      ) : (
        <motion.div
          className="absolute inset-y-0 w-[32%] max-w-[160px] rounded-full bg-primary/90 shadow-[0_0_6px_hsl(var(--primary)/0.3)]"
          initial={{ left: "-32%" }}
          animate={{ left: "100%" }}
          transition={{
            repeat: Infinity,
            duration: 1.08,
            ease: EASING_OUT_BEZIER,
          }}
        />
      )}
    </div>
  );
}
