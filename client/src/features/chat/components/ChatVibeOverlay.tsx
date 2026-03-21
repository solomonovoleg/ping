import { motion, AnimatePresence } from "framer-motion";
import { useId, type FC } from "react";
import {
  usePrefersReducedMotion,
  DURATION_CHAT_VIBE_CROSSFADE_MS,
  DURATION_FAST_MS,
  EASING_CHAT_VIBE_BEZIER,
} from "@/lib/motion";
import type { VibeThemeTokens, VibeThemeCode } from "@shared/chat-vibe-types";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";

type Props = {
  theme: VibeThemeCode;
  tokens: VibeThemeTokens;
  isActive: boolean;
};

function HeartsPattern({ pid }: { pid: string }) {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
      <defs>
        <pattern id={`${pid}-hearts`} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <text x="10" y="30" fontSize="14" fill="currentColor" opacity="0.3">
            ♥
          </text>
          <text x="40" y="50" fontSize="10" fill="currentColor" opacity="0.2">
            ♥
          </text>
          <text x="25" y="12" fontSize="8" fill="currentColor" opacity="0.15">
            ♥
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid}-hearts)`} />
    </svg>
  );
}

function GridPattern({ pid }: { pid: string }) {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`${pid}-grid`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid}-grid)`} />
    </svg>
  );
}

function WavesPattern({ pid }: { pid: string }) {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`${pid}-waves`} x="0" y="0" width="120" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M0 20 Q30 0 60 20 Q90 40 120 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.12"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${pid}-waves)`} />
    </svg>
  );
}

function DustPattern(_: { pid: string }) {
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, currentColor 0.5px, transparent 0.5px),
                          radial-gradient(circle at 70% 60%, currentColor 0.3px, transparent 0.3px),
                          radial-gradient(circle at 45% 80%, currentColor 0.4px, transparent 0.4px)`,
        backgroundSize: "80px 80px, 60px 60px, 100px 100px",
        opacity: 0.15,
      }}
    />
  );
}

const OVERLAY_COMPONENTS: Record<string, FC<{ pid: string }>> = {
  hearts: HeartsPattern,
  grid: GridPattern,
  waves: WavesPattern,
  dust: DustPattern,
};

/** Длительность «дыхания» паттерна по пресету анимации темы */
function breatheDuration(animationPreset: VibeThemeTokens["animationPreset"], reduced: boolean): number {
  if (reduced) return 0;
  switch (animationPreset) {
    case "romantic":
      return 9;
    case "playful":
      return 5.5;
    case "strict":
      return 12;
    case "tense":
      return 6;
    default:
      return 8;
  }
}

export function ChatVibeOverlay({ theme, tokens, isActive }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = getIntensityScale();
  const pid = useId().replace(/:/g, "");
  const OverlayComponent = OVERLAY_COMPONENTS[tokens.overlayType];

  if (!isActive || !OverlayComponent || tokens.overlayType === "none") return null;

  const baseOpacity = tokens.overlayOpacity * scale;
  const breathe = breatheDuration(tokens.animationPreset, reducedMotion);

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={`vibe-overlay-${theme}-${tokens.overlayType}`}
        className="absolute inset-0 pointer-events-none z-0 overflow-hidden text-foreground/40"
        style={{ mixBlendMode: "soft-light" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: baseOpacity }}
        exit={{ opacity: 0 }}
        transition={
          reducedMotion
            ? { duration: DURATION_FAST_MS / 1000, ease: EASING_CHAT_VIBE_BEZIER }
            : { duration: DURATION_CHAT_VIBE_CROSSFADE_MS / 1000, ease: EASING_CHAT_VIBE_BEZIER }
        }
      >
        <motion.div
          className="h-full w-full"
          animate={
            reducedMotion || breathe === 0
              ? undefined
              : {
                  scale: [1, 1.02, 1],
                  opacity: [0.92, 1, 0.92],
                }
          }
          transition={
            reducedMotion || breathe === 0
              ? undefined
              : {
                  duration: breathe,
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        >
          <OverlayComponent pid={pid} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
