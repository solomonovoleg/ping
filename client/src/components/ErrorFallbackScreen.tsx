import { useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCw } from "lucide-react";
import {
  usePrefersReducedMotion,
  DURATION_NORMAL_S,
  EASING_OUT_BEZIER,
} from "@/lib/motion";

interface ErrorFallbackScreenProps {
  /** Display code: "ERROR", "404", etc. */
  code?: string;
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
  onBack?: () => void;
  /** Raw error message shown only in dev mode */
  devError?: string | null;
}

/* ─── animated glitch code ─── */

const EASE: [number, number, number, number] = [...EASING_OUT_BEZIER];

function GlitchCode({ text, paused }: { text: string; paused: boolean }) {
  if (paused) {
    return (
      <p className="text-6xl sm:text-7xl font-mono font-black tracking-widest text-destructive/70 select-none">
        {text}
      </p>
    );
  }

  return (
    <div className="relative select-none">
      {/* Cyan shadow layer (glitch offset) */}
      <motion.p
        className="absolute inset-0 text-6xl sm:text-7xl font-mono font-black tracking-widest text-cyan-500/25"
        aria-hidden
        animate={{ x: [-2, 2, -1, 0], opacity: [0, 0.6, 0, 0.3, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.08, 0.12, 0.55, 1],
        }}
      >
        {text}
      </motion.p>

      {/* Red shadow layer (glitch offset) */}
      <motion.p
        className="absolute inset-0 text-6xl sm:text-7xl font-mono font-black tracking-widest text-red-500/25"
        aria-hidden
        animate={{ x: [2, -2, 1, 0], opacity: [0, 0.5, 0, 0.2, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "linear",
          times: [0, 0.12, 0.18, 0.6, 1],
        }}
      >
        {text}
      </motion.p>

      {/* Main text — letters stagger in */}
      <p className="relative text-6xl sm:text-7xl font-mono font-black tracking-widest text-destructive/80">
        <span className="inline-flex">
          {text.split("").map((char, i) => (
            <motion.span
              key={i}
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.09, duration: 0.5, ease: EASE }}
              className="inline-block"
            >
              {char}
            </motion.span>
          ))}
        </span>
      </p>
    </div>
  );
}

/* ─── pulse rings (sonar effect) ─── */

const RING_COUNT = 3;

function PulseRings({ paused }: { paused: boolean }) {
  if (paused) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-hidden
    >
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border border-destructive/10"
          animate={{ scale: [0.6, 2], opacity: [0.6, 0] }}
          transition={{
            duration: 3,
            delay: i * 0.9,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── scan line (horizontal glitch bar) ─── */

function ScanLine({ paused }: { paused: boolean }) {
  if (paused) return null;

  return (
    <motion.div
      className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-destructive/30 to-transparent pointer-events-none"
      aria-hidden
      animate={{ top: ["0%", "100%"] }}
      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
    />
  );
}

/* ─── stagger orchestration ─── */

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL_S, ease: EASE },
  },
};

/* ─── main component ─── */

export function ErrorFallbackScreen({
  code = "ERROR",
  title = "Что-то пошло не так",
  subtitle = "Произошла ошибка. Попробуйте обновить страницу.",
  onRetry,
  onBack,
  devError,
}: ErrorFallbackScreenProps) {
  const reducedMotion = usePrefersReducedMotion();

  const handleRetry = useCallback(() => {
    onRetry ? onRetry() : window.location.reload();
  }, [onRetry]);

  const handleBack = useCallback(() => {
    onBack ? onBack() : window.history.back();
  }, [onBack]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-background p-6 overflow-hidden">
      <motion.div
        className="flex flex-col items-center text-center gap-5 max-w-md w-full"
        variants={reducedMotion ? undefined : containerVariants}
        initial={reducedMotion ? undefined : "hidden"}
        animate={reducedMotion ? undefined : "visible"}
      >
        {/* Hero — animated error code with rings + scan line */}
        <motion.div
          variants={reducedMotion ? undefined : itemVariants}
          className="relative flex items-center justify-center py-6"
        >
          <PulseRings paused={reducedMotion} />
          <ScanLine paused={reducedMotion} />
          <GlitchCode text={code} paused={reducedMotion} />
        </motion.div>

        {/* Title */}
        <motion.h1
          variants={reducedMotion ? undefined : itemVariants}
          className="text-xl sm:text-2xl font-bold text-foreground"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={reducedMotion ? undefined : itemVariants}
          className="text-sm text-muted-foreground max-w-xs leading-relaxed"
        >
          {subtitle}
        </motion.p>

        {/* Dev-only raw error */}
        {devError && (
          <motion.pre
            variants={reducedMotion ? undefined : itemVariants}
            className="text-left text-xs text-muted-foreground max-w-full overflow-auto p-3 bg-muted rounded-lg w-full"
          >
            {devError}
          </motion.pre>
        )}

        {/* Action buttons */}
        <motion.div
          variants={reducedMotion ? undefined : itemVariants}
          className="flex items-center gap-3 pt-3"
        >
          <button
            type="button"
            onClick={handleRetry}
            className="min-h-[var(--uix-touch-min)] px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all"
            aria-label="Попробовать снова"
          >
            <RotateCw className="w-4 h-4" />
            Попробовать снова
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[var(--uix-touch-min)] px-5 py-2.5 rounded-full bg-secondary text-foreground text-sm font-medium inline-flex items-center gap-2 hover:opacity-90 active:scale-[0.97] transition-all"
            aria-label="Вернуться назад"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
