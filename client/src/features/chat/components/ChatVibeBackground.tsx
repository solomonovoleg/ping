import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion, DURATION_EMPHASIS_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import type { VibeThemeTokens } from "@shared/chat-vibe-types";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";

type Props = {
  tokens: VibeThemeTokens;
  isActive: boolean;
};

const INTENSITY_OPACITY: Record<string, number> = {
  low: 0.06,
  medium: 0.12,
  high: 0.18,
};

export function ChatVibeBackground({ tokens, isActive }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = getIntensityScale();

  if (!isActive || tokens.backgroundTint === "transparent") return null;

  const opacity = scale <= 0.4 ? INTENSITY_OPACITY.low : scale <= 0.7 ? INTENSITY_OPACITY.medium : INTENSITY_OPACITY.high;

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="vibe-bg"
          className="absolute inset-0 pointer-events-none z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity }}
          exit={{ opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: DURATION_EMPHASIS_MS / 1000, ease: EASING_OUT_BEZIER as unknown as number[] }
          }
          style={{
            background: `radial-gradient(ellipse at 50% 30%, ${tokens.backgroundTint} 0%, transparent 70%)`,
          }}
        />
      )}
    </AnimatePresence>
  );
}
