import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Check, X, Loader2, ChevronDown } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER } from "@/lib/motion";

export type PingokVoiceVisualPhase = "listening" | "recognized" | "done";

const BARS = [
  0.38, 0.72, 0.55, 1.0, 0.48, 0.88, 0.62, 1.1, 0.44, 0.79, 0.95, 0.58, 0.83, 0.67, 1.05, 0.42, 0.76, 0.6, 0.9, 0.5, 0.85,
  0.65,
];

type Props = {
  visualPhase: PingokVoiceVisualPhase;
  recognizedText: string;
  doneTitle: string;
  doneSubtitle: string;
  processingLabel?: string | null;
  streamMode: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onSubmitStream: () => void;
  children?: React.ReactNode;
};

/**
 * Панель голоса над навбаром (UIX PULSE Voice Widget).
 */
export function PingokVoicePanel({
  visualPhase,
  recognizedText,
  doneTitle,
  doneSubtitle,
  processingLabel,
  streamMode,
  reducedMotion,
  onClose,
  onSubmitStream,
  children,
}: Props) {
  const listening = visualPhase === "listening";
  const recognized = visualPhase === "recognized";
  const done = visualPhase === "done";
  const closeTimerRef = useRef<number | null>(null);
  const [swipeClosing, setSwipeClosing] = useState(false);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const closeWithSnap = (): void => {
    if (swipeClosing) return;
    setSwipeClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, 150);
  };

  return (
    <motion.div
      className="pingok-voice-panel fixed left-3 right-3 z-[110] mx-auto max-w-md overflow-hidden rounded-[20px] border shadow-[0_20px_56px_rgba(0,0,0,0.8)]"
      style={{
        bottom: "calc(var(--uix-nav-bottom) + 10px)",
        borderColor: done ? "rgba(238,42,123,0.22)" : "rgba(255,255,255,0.09)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pingok-voice-panel-title"
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={swipeClosing ? { opacity: 0, y: 110, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? undefined : { opacity: 0, y: 10 }}
      drag={reducedMotion ? false : "y"}
      dragDirectionLock
      dragMomentum={false}
      dragElastic={{ top: 0, bottom: 0.24 }}
      dragConstraints={{ top: 0, bottom: 140 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 96 || info.velocity.y > 760) closeWithSnap();
      }}
      transition={
        swipeClosing
          ? { type: "spring", stiffness: 430, damping: 34, mass: 0.95 }
          : { duration: reducedMotion ? 0 : DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "linear-gradient(158deg,#0e0c1e 0%,#080512 45%,#0c0a1a 100%)",
          backdropFilter: "blur(40px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(125deg,rgba(129,140,248,.05) 0%,rgba(167,139,250,.03) 30%,transparent 55%,rgba(99,102,241,.04) 80%,rgba(139,92,246,.05) 100%)",
        }}
      />

      <div
        className="relative h-0.5 w-full"
        style={{
          background: done
            ? "linear-gradient(90deg,transparent,#f9ce34,#ee2a7b,#6228d7,transparent)"
            : "linear-gradient(90deg,transparent,rgba(129,140,248,.5),rgba(167,139,250,.6),rgba(129,140,248,.5),transparent)",
        }}
      />

      <div className="relative px-[18px] pb-4 pt-3.5">
        <div className="mb-2 flex justify-center">
          <div
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/40"
            aria-hidden
          >
            <ChevronDown className="h-3 w-3" />
            Свайп вниз
          </div>
        </div>
        <div className="absolute right-2 top-2 z-10">
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/40 hover:bg-white/5 hover:text-white/70"
            aria-label="Закрыть голосовое управление"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </TapScaleButton>
        </div>

        <div className={cn("flex items-center gap-3 pr-10", listening ? "mb-3.5" : "mb-2.5")}>
          <div
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl border"
            style={{
              background: done ? "rgba(238,42,123,.12)" : "rgba(129,140,248,.12)",
              borderColor: done ? "rgba(238,42,123,.35)" : "rgba(129,140,248,.20)",
            }}
          >
            {done ? (
              <Check className="h-4 w-4 text-[#ee2a7b]" strokeWidth={2.8} aria-hidden />
            ) : (
              <Mic className="h-[15px] w-[15px] text-[#818cf8]" strokeWidth={2} aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div
              id="pingok-voice-panel-title"
              className="text-[14.5px] font-[650] leading-none tracking-[-0.025em] pingok-voice-v-in"
              style={{ color: "rgba(255,255,255,.92)" }}
            >
              {listening && "Слушаю"}
              {recognized && "Распознана команда"}
              {done && "Готово"}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,.32)" }}>
              {listening && (streamMode ? "Стрим — говорите, затем «Готово»" : "Голосовое управление")}
              {recognized && (processingLabel || "Обрабатываю…")}
              {done && doneSubtitle}
            </div>
          </div>
          {listening && (
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="pingok-voice-live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
              <span className="text-[10px] font-semibold tracking-[0.08em]" style={{ color: "rgba(255,255,255,.38)" }}>
                LIVE
              </span>
            </div>
          )}
          {recognized && (
            <span className="shrink-0 text-[10px]" style={{ color: "rgba(129,140,248,.65)" }}>
              AI
            </span>
          )}
        </div>

        {listening && !reducedMotion ? (
          <div className="pingok-voice-v-in relative mb-1 h-[46px] overflow-hidden">
            <div
              className="pingok-voice-aurora pointer-events-none absolute -bottom-1.5 -left-2 -right-2 h-6 rounded-[50%] blur-[14px]"
              style={{
                background: "linear-gradient(90deg,#4f46e5,#7c3aed,#06b6d4,#6d28d9,#4f46e5)",
                backgroundSize: "300% 100%",
              }}
            />
            <div className="relative flex h-full items-center justify-between">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="pingok-voice-bar shrink-0 rounded-full"
                  style={{
                    width: 3,
                    height: `${Math.max(5, h * 38)}px`,
                    background: "linear-gradient(to top,#3730a3,#7c3aed,#818cf8,#67e8f9)",
                    backgroundSize: "100% 250%",
                    transformOrigin: "center",
                    animation: `pingok-v-bar ${(0.42 + (i % 9) * 0.08).toFixed(2)}s ease-in-out infinite ${(i * 0.048).toFixed(2)}s, pingok-v-bar-shimmer ${(1.4 + (i % 6) * 0.25).toFixed(2)}s ease-in-out infinite ${(i * 0.048).toFixed(2)}s`,
                  }}
                />
              ))}
            </div>
            <div className="pingok-voice-sweep pointer-events-none absolute inset-y-0 left-0 w-[14%] opacity-90" />
          </div>
        ) : null}

        {listening && reducedMotion ? (
          <div className="mb-2 flex h-10 items-end justify-center gap-0.5">
            {BARS.slice(0, 12).map((h, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-indigo-400/70"
                style={{ height: `${Math.max(4, h * 28)}px` }}
              />
            ))}
          </div>
        ) : null}

        {listening ? (
          <div
            className="mb-2 rounded-xl border px-3 py-2 text-[13px] leading-snug"
            style={{
              background: "rgba(255,255,255,.04)",
              borderColor: "rgba(129,140,248,.25)",
              color: "rgba(255,255,255,.82)",
            }}
          >
            {recognizedText && recognizedText !== "…"
              ? recognizedText
              : "Скажите команду сразу, например: «Напиши Илоне привет» — текст появится здесь вживую"}
          </div>
        ) : null}

        {streamMode && listening ? (
          <TapScaleButton
            type="button"
            haptic
            className="mb-2 w-full rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2 text-[12px] font-medium text-cyan-200/90"
            onClick={onSubmitStream}
          >
            Готово — обработать
          </TapScaleButton>
        ) : null}

        {recognized ? (
          <div className="pingok-voice-v-in">
            <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-indigo-300/25 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-medium text-indigo-200/90">
              <Loader2 className="h-3 w-3 animate-spin" />
              {processingLabel || "Обрабатываю команду"}
            </div>
            <div
              className="rounded-xl border px-3.5 py-2.5"
              style={{ background: "rgba(255,255,255,.05)", borderColor: "rgba(255,255,255,.09)" }}
            >
              <span className="text-[14px] font-medium leading-snug" style={{ color: "rgba(255,255,255,.88)" }}>
                {recognizedText || "…"}
              </span>
            </div>
          </div>
        ) : null}

        {done ? (
          <div className="pingok-voice-v-in flex items-start gap-3.5">
            <div
              className="pingok-voice-check flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border"
              style={{
                background: "rgba(238,42,123,.12)",
                borderColor: "rgba(238,42,123,.35)",
              }}
            >
              <Check className="h-[19px] w-[19px] text-[#ee2a7b]" strokeWidth={2.8} aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <div
                className="text-[15px] font-[650] leading-tight tracking-[-0.025em]"
                style={{ color: "rgba(255,255,255,.92)" }}
              >
                {doneTitle}
              </div>
            </div>
          </div>
        ) : null}

        {children ? <div className="mt-3 max-h-[38vh] space-y-2 overflow-y-auto">{children}</div> : null}
      </div>
    </motion.div>
  );
}
