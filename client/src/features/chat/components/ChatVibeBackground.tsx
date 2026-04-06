import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  usePrefersReducedMotion,
  DURATION_CHAT_VIBE_CROSSFADE_MS,
  DURATION_FAST_MS,
  EASING_CHAT_VIBE_BEZIER,
} from "@/lib/motion";
import type { VibeThemeTokens, VibeThemeCode } from "@shared/chat-vibe-types";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";
import { PULSE_THEME_ACCENTS } from "@/lib/chat-vibe-themes";
import { cn } from "@/lib/utils";
import { ChatPulseMoodPattern } from "./ChatPulseMoodPattern";

type Props = {
  theme: VibeThemeCode;
  tokens: VibeThemeTokens;
  isActive: boolean;
  isDarkSurface: boolean;
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

export function ChatVibeBackground({ theme, tokens, isActive, isDarkSurface }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = getIntensityScale();
  const [isIdle, setIsIdle] = useState(false);

  const opacity = scale <= 0.4 ? INTENSITY_OPACITY.low : scale <= 0.7 ? INTENSITY_OPACITY.medium : INTENSITY_OPACITY.high;
  const grainOpacity = Math.min(0.055 + scale * 0.025, 0.11);
  const crossfadeSec = reducedMotion ? DURATION_FAST_MS / 1000 : DURATION_CHAT_VIBE_CROSSFADE_MS / 1000;
  /** Паттерн кроссфейдится тем же темпом, что и градиент (раньше был ~0.32× — смена выглядела рывком). */
  const patternSwitchSec = crossfadeSec;
  const grainDriftSec = reducedMotion ? 0 : 14;
  const patternTheme = resolvePatternTheme(theme, tokens.overlayType);
  const overlayStrength =
    tokens.overlayType === "none"
      ? 0.56
      : Math.min(1.12, 0.7 + Math.max(tokens.overlayOpacity, 0) * 4.8);
  const patternOpacity = Math.min((0.55 + scale * 0.2) * overlayStrength, 0.92);
  const accent = PULSE_THEME_ACCENTS[patternTheme] ?? PULSE_THEME_ACCENTS.casual;
  const idleLoopSec = Math.max(8, (DURATION_CHAT_VIBE_CROSSFADE_MS * 2) / 1000);

  useEffect(() => {
    if (reducedMotion || typeof window === "undefined") {
      setIsIdle(false);
      return;
    }

    let timer: number | undefined;
    const IDLE_AFTER_MS = 3800;
    const bump = () => {
      setIsIdle(false);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsIdle(true), IDLE_AFTER_MS);
    };
    bump();

    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("touchstart", bump, { passive: true });
    window.addEventListener("wheel", bump, { passive: true });
    window.addEventListener("keydown", bump);

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("touchstart", bump);
      window.removeEventListener("wheel", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [reducedMotion, patternTheme]);

  if (!isActive || tokens.backgroundTint === "transparent") return null;

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
              : { duration: crossfadeSec, ease: EASING_CHAT_VIBE_BEZIER }
          }
          style={{
            background: `radial-gradient(ellipse 120% 80% at 50% 28%, ${tokens.backgroundTint} 0%, transparent 68%),
              radial-gradient(ellipse 90% 55% at 80% 85%, ${tokens.backgroundTint} 0%, transparent 55%)`,
          }}
        />
      </AnimatePresence>

      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={`pat-${patternTheme}-${tokens.overlayType}`}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: patternOpacity }}
          exit={{ opacity: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: patternSwitchSec, ease: EASING_CHAT_VIBE_BEZIER }
          }
        >
          <motion.div
            className="absolute inset-0"
            animate={
              reducedMotion || !isIdle
                ? { x: 0, y: 0, scale: 1 }
                : {
                    x: [0, 1.5, -1, 0],
                    y: [0, -1, 1, 0],
                    scale: [1, 1.004, 1],
                  }
            }
            transition={
              reducedMotion || !isIdle
                ? { duration: 0 }
                : { duration: idleLoopSec, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <ChatPulseMoodPattern
              theme={patternTheme}
              accentColor={accent}
              isDarkSurface={isDarkSurface}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        </motion.div>
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

function resolvePatternTheme(theme: VibeThemeCode, overlayType: VibeThemeTokens["overlayType"]): VibeThemeCode {
  if (overlayType === "hearts") return "romantic";
  if (overlayType === "grid") return theme === "gaming" ? "gaming" : "business";
  if (overlayType === "waves") return theme === "support" ? "support" : "relax";
  if (overlayType === "dust") return "fun";
  return theme;
}
