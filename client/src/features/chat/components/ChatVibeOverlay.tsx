import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion, DURATION_EMPHASIS_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import type { VibeThemeTokens } from "@shared/chat-vibe-types";
import { getIntensityScale } from "@/lib/chat-vibe-prefs";

type Props = {
  tokens: VibeThemeTokens;
  isActive: boolean;
};

function HeartsPattern() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="opacity-60">
      <defs>
        <pattern id="hearts" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <text x="10" y="30" fontSize="14" fill="currentColor" opacity="0.3">♥</text>
          <text x="40" y="50" fontSize="10" fill="currentColor" opacity="0.2">♥</text>
          <text x="25" y="12" fontSize="8" fill="currentColor" opacity="0.15">♥</text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#hearts)" />
    </svg>
  );
}

function GridPattern() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function WavesPattern() {
  return (
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="waves" x="0" y="0" width="120" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M0 20 Q30 0 60 20 Q90 40 120 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.12"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#waves)" />
    </svg>
  );
}

function DustPattern() {
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

const OVERLAY_COMPONENTS: Record<string, React.FC> = {
  hearts: HeartsPattern,
  grid: GridPattern,
  waves: WavesPattern,
  dust: DustPattern,
};

export function ChatVibeOverlay({ tokens, isActive }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const scale = getIntensityScale();
  const OverlayComponent = OVERLAY_COMPONENTS[tokens.overlayType];

  if (!isActive || !OverlayComponent || tokens.overlayType === "none") return null;

  const opacity = tokens.overlayOpacity * scale;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`vibe-overlay-${tokens.overlayType}`}
        className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
        style={{ mixBlendMode: "soft-light", opacity }}
        initial={{ opacity: 0 }}
        animate={{ opacity }}
        exit={{ opacity: 0 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { duration: DURATION_EMPHASIS_MS / 1000, ease: EASING_OUT_BEZIER as unknown as number[] }
        }
      >
        <OverlayComponent />
      </motion.div>
    </AnimatePresence>
  );
}
