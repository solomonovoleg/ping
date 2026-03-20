import { motion, AnimatePresence } from "framer-motion";
import {
  usePrefersReducedMotion,
  DURATION_EMPHASIS_MS,
  DURATION_FAST_MS,
  EASING_OUT_BEZIER,
} from "@/lib/motion";
import type { VibeThemeTokens, VibeThemeCode } from "@shared/chat-vibe-types";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";
import { cn } from "@/lib/utils";

type Props = {
  theme: VibeThemeCode;
  tokens: VibeThemeTokens;
  isActive: boolean;
};

const INTENSITY_OPACITY: Record<string, number> = {
  low: 0.06,
  medium: 0.12,
  high: 0.18,
};

/** Лёгкий шум (как текстура фона в мессенджерах) — SVG feTurbulence */
const NOISE_TILE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch"/></filter>
    <rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/>
  </svg>`,
);

export function ChatVibeBackground({ theme, tokens, isActive }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = getIntensityScale();

  if (!isActive || tokens.backgroundTint === "transparent") return null;

  const opacity = scale <= 0.4 ? INTENSITY_OPACITY.low : scale <= 0.7 ? INTENSITY_OPACITY.medium : INTENSITY_OPACITY.high;
  const grainOpacity = Math.min(0.055 + scale * 0.025, 0.11);
  const crossfadeSec = reducedMotion ? DURATION_FAST_MS / 1000 : DURATION_EMPHASIS_MS / 1000;
  const grainDriftSec = reducedMotion ? 0 : 14;

  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={theme}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: crossfadeSec, ease: EASING_OUT_BEZIER }
          }
          style={{
            background: `radial-gradient(ellipse 120% 80% at 50% 28%, ${tokens.backgroundTint} 0%, transparent 68%),
              radial-gradient(ellipse 90% 55% at 80% 85%, ${tokens.backgroundTint} 0%, transparent 55%)`,
          }}
        />
      </AnimatePresence>

      {/* Текстура поверх градиента */}
      <motion.div
        className={cn(
          "absolute -inset-[10%] mix-blend-overlay",
          reducedMotion ? "" : "will-change-transform",
        )}
        style={{
          opacity: grainOpacity,
          backgroundImage: `url("data:image/svg+xml,${NOISE_TILE}")`,
          backgroundSize: "96px 96px",
          backgroundRepeat: "repeat",
        }}
        animate={
          reducedMotion
            ? undefined
            : {
                x: [0, -28, 0],
                y: [0, -20, 0],
              }
        }
        transition={
          reducedMotion
            ? undefined
            : {
                duration: grainDriftSec,
                repeat: Infinity,
                ease: "linear",
              }
        }
      />
    </div>
  );
}
