import { useCallback, useId, useRef, useState } from "react";
import { ArrowUp, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { playPingokReadySound, triggerTapFeedback } from "@/lib/micro-feedback";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { PingokMicroOverlay } from "./PingokMicroOverlay";
import { PINGOK_LOGO_LONG_PRESS_MS } from "./constants";

const RING_C = 2 * Math.PI * 24;
const ACCENT = "#818cf8";
const SWIPE_UP_PX = 36;
/** Соответствует viewBox кольца (52×52) и укладывается в `--uix-nav-height` без налёта на контент. */
const PULSE_BUTTON_SCALE = 1;
const BUTTON_SIZE_PX = Math.round(52 * PULSE_BUTTON_SCALE);
const INNER_SIZE_PX = Math.round(44 * PULSE_BUTTON_SCALE);
const LOGO_IDLE_SIZE_PX = Math.round(24 * PULSE_BUTTON_SCALE);
const LOGO_ACTIVE_SIZE_PX = Math.round(26 * PULSE_BUTTON_SCALE);

type VoiceMode = "record" | "stream";

type Props = {
  isActive: boolean;
  logoSrc: string;
  onShortPress: () => void;
};

/**
 * Центр PULSE: тап → профиль; удержание 2.8 с (кольцо) → отпускание → голос;
 * при удержании свайп вверх → режим стрима.
 */
export function NavPulseCenterLogoButton({ isActive, logoSrc, onShortPress }: Props) {
  const ringGradId = useId().replace(/:/g, "");
  const reducedMotion = usePrefersReducedMotion();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("record");
  const [holding, setHolding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressEligibleRef = useRef(false);
  const pointerDownRef = useRef(false);
  const startYRef = useRef(0);
  const minYRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetHold = useCallback(() => {
    clearTimer();
    pointerDownRef.current = false;
    longPressEligibleRef.current = false;
    setHolding(false);
  }, [clearTimer]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerDownRef.current = true;
      longPressEligibleRef.current = false;
      startYRef.current = e.clientY;
      minYRef.current = e.clientY;
      setHolding(true);
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (!pointerDownRef.current) return;
        longPressEligibleRef.current = true;
        triggerSelectionHaptic();
        playPingokReadySound();
        const swipeUpNow = startYRef.current - minYRef.current >= SWIPE_UP_PX;
        setVoiceMode(swipeUpNow ? "stream" : "record");
        setVoiceOpen(true);
        resetHold();
      }, PINGOK_LOGO_LONG_PRESS_MS);
    },
    [clearTimer, resetHold],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    minYRef.current = Math.min(minYRef.current, e.clientY);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      if (!pointerDownRef.current) return;
      const eligible = longPressEligibleRef.current;
      const swipeUp = startYRef.current - minYRef.current >= SWIPE_UP_PX;
      resetHold();
      if (!eligible) {
        triggerTapFeedback({ haptic: true, sound: true });
        onShortPress();
        return;
      }
      triggerTapFeedback({ haptic: true, sound: false });
      setVoiceMode(swipeUp ? "stream" : "record");
      setVoiceOpen(true);
    },
    [onShortPress, resetHold],
  );

  const onPointerCancel = useCallback(() => {
    resetHold();
  }, [resetHold]);

  const voiceActive = voiceOpen;

  return (
    <>
      <PingokMicroOverlay
        open={voiceOpen}
        voiceMode={voiceMode}
        onClose={() => setVoiceOpen(false)}
      />
      <div
        className={cn(
          "relative flex min-w-0 items-center justify-center overflow-visible",
          "pb-0 pt-0",
        )}
      >
        {holding && !reducedMotion ? (
          <div
            className="pointer-events-none absolute bottom-[calc(100%+12px)] left-1/2 z-50 flex gap-2 whitespace-nowrap"
            style={{ animation: "pingok-hint-in 0.3s ease forwards" }}
          >
            <div
              className="flex flex-col items-center gap-0.5 rounded-xl border px-3 py-1.5"
              style={{
                borderColor: "rgba(129,140,248,.35)",
                background: "rgba(12,10,26,.92)",
                backdropFilter: "blur(16px)",
              }}
            >
              <Hand className="h-4 w-4 text-violet-300" aria-hidden />
              <span className="text-[9px] font-bold text-white/90">отпусти</span>
              <span className="text-[8px]" style={{ color: "rgba(129,140,248,.8)" }}>
                запись
              </span>
            </div>
            <div
              className="flex flex-col items-center gap-0.5 rounded-xl border px-3 py-1.5"
              style={{
                borderColor: "rgba(6,182,212,.35)",
                background: "rgba(12,10,26,.92)",
                backdropFilter: "blur(16px)",
              }}
            >
              <ArrowUp className="h-4 w-4 text-cyan-400" aria-hidden />
              <span className="text-[9px] font-bold text-white/90">свайп</span>
              <span className="text-[8px]" style={{ color: "rgba(6,182,212,.8)" }}>
                стрим
              </span>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          data-testid="mobile-nav-pulse"
          aria-label="Моя страница. Удерживайте для голосового управления."
          title="Моя страница · удерживайте для голоса"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onPointerLeave={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          onTouchStart={(e) => e.preventDefault()}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-2xl select-none touch-none",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
          style={{
            width: BUTTON_SIZE_PX,
            height: BUTTON_SIZE_PX,
            filter: voiceActive ? `drop-shadow(0 0 10px ${ACCENT}88)` : undefined,
            transition: "filter .4s ease",
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
          }}
        >
          <div
            className={cn(
              "absolute inset-0 scale-0 rounded-full bg-primary/12 transition-transform duration-150",
              isActive && "scale-100",
            )}
          />

          {holding && !reducedMotion ? (
            <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 52 52" aria-hidden>
              <circle cx="26" cy="26" r="24" fill="none" stroke="rgba(129,140,248,.18)" strokeWidth="2" />
              <circle
                cx="26"
                cy="26"
                r="24"
                fill="none"
                stroke={`url(#${ringGradId})`}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={RING_C}
                className="pingok-ring-animate"
                style={{
                  transformOrigin: "26px 26px",
                  transform: "rotate(-90deg)",
                }}
              />
              <defs>
                <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="50%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
            </svg>
          ) : null}

          {voiceActive && !reducedMotion ? (
            <>
              <div
                className="pointer-events-none absolute -inset-2 rounded-full border-[1.5px]"
                style={{
                  borderColor: `${ACCENT}44`,
                  animation: "pingok-ring-pulse 1.6s ease-in-out infinite",
                }}
              />
              <div
                className="pointer-events-none absolute -inset-4 rounded-full border"
                style={{
                  borderColor: `${ACCENT}22`,
                  animation: "pingok-ring-pulse 1.6s ease-in-out infinite 0.5s",
                }}
              />
            </>
          ) : null}

          <div
            className="relative z-10 flex size-11 items-center justify-center rounded-[14px] border-[1.5px] border-white/15 transition-transform duration-200"
            style={{
              width: INNER_SIZE_PX,
              height: INNER_SIZE_PX,
              overflow: "hidden",
              background: holding
                ? `linear-gradient(145deg,${ACCENT},#7c3aed,${ACCENT}99)`
                : voiceActive
                  ? `linear-gradient(145deg,${ACCENT},#06b6d4)`
                  : "transparent",
              borderColor: holding || voiceActive ? "rgba(255,255,255,.15)" : "transparent",
              transform: holding ? "scale(1.08)" : "scale(1)",
              animation: holding && !reducedMotion ? "pingok-mode-glow 1.2s ease-in-out infinite" : undefined,
            }}
          >
            <img
              src={logoSrc}
              alt=""
              className="object-contain select-none pointer-events-none transition-[width,height] duration-200"
              style={{
                width: holding || voiceActive ? LOGO_ACTIVE_SIZE_PX : LOGO_IDLE_SIZE_PX,
                height: holding || voiceActive ? LOGO_ACTIVE_SIZE_PX : LOGO_IDLE_SIZE_PX,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </button>
      </div>
    </>
  );
}
