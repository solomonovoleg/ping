import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckSquare, MessageCircle, PhoneForwarded } from "lucide-react";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import type { PingokSuccessFlightPayload } from "./pingok-success-flight-types";

const HOLD_MS = 520;
const EXIT_MS = 520;
const ENTER_MS = 220;

type Props = {
  payload: PingokSuccessFlightPayload | null;
  reducedMotion: boolean;
  onComplete: () => void;
};

function targetSelector(target: PingokSuccessFlightPayload["target"]): string {
  return `[data-pingok-flight-target="${target}"]`;
}

export function PingokSuccessFlight({ payload, reducedMotion, onComplete }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const [phase, setPhase] = useState<"idle" | "in" | "hold" | "exit">("idle");
  const [exitDelta, setExitDelta] = useState({ x: 0, y: 0, scale: 0.14 });

  const runExit = useCallback(() => {
    const p = payloadRef.current;
    const card = cardRef.current;
    if (!p || !card || typeof window === "undefined") {
      setPhase("exit");
      return;
    }
    const c = card.getBoundingClientRect();
    const cx = c.left + c.width / 2;
    const cy = c.top + c.height / 2;
    const el = document.querySelector(targetSelector(p.target));
    let x = 0;
    let y = 0;
    if (el) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2 - cx;
      y = r.top + r.height / 2 - cy;
    } else {
      x = 52 - cx;
      y = window.innerHeight - (window.visualViewport?.offsetTop ?? 0) - 88 - cy;
    }
    setExitDelta({ x, y, scale: 0.12 });
    setPhase("exit");
  }, []);

  useEffect(() => {
    if (!payload) {
      setPhase("idle");
      return;
    }
    setPhase("in");
    const t = window.setTimeout(() => setPhase("hold"), ENTER_MS + 40);
    return () => window.clearTimeout(t);
  }, [payload]);

  useEffect(() => {
    if (phase !== "hold" || !payload) return;
    if (reducedMotion) {
      const t = window.setTimeout(() => {
        onComplete();
      }, HOLD_MS + 200);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(runExit, HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, payload, reducedMotion, runExit, onComplete]);

  useEffect(() => {
    if (phase !== "exit" || !payload) return;
    if (reducedMotion) return;
    const t = window.setTimeout(onComplete, EXIT_MS + 40);
    return () => window.clearTimeout(t);
  }, [phase, payload, reducedMotion, onComplete]);

  if (typeof document === "undefined") return null;

  const node = (
    <AnimatePresence>
      {payload && phase !== "idle" ? (
        <div
          className="pointer-events-none fixed inset-0 z-[130] flex items-center justify-center p-4"
          aria-live="polite"
          aria-atomic="true"
        >
          <motion.div
            key={payload.id}
            ref={cardRef}
            role="status"
            initial={
              reducedMotion
                ? { opacity: 0, scale: 0.98 }
                : { opacity: 0, scale: 0.88, y: 28 }
            }
            animate={
              reducedMotion
                ? { opacity: phase === "hold" || phase === "in" ? 1 : 0, scale: 1, y: 0 }
                : phase === "exit"
                  ? {
                      opacity: 0.08,
                      scale: exitDelta.scale,
                      x: exitDelta.x,
                      y: exitDelta.y,
                    }
                  : { opacity: 1, scale: 1, y: 0, x: 0 }
            }
            exit={{ opacity: 0 }}
            transition={
              reducedMotion
                ? { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }
                : phase === "exit"
                  ? { duration: EXIT_MS / 1000, ease: EASING_OUT_BEZIER }
                  : { duration: ENTER_MS / 1000, ease: EASING_OUT_BEZIER }
            }
            className="pointer-events-none w-[min(92vw,320px)] rounded-2xl border shadow-2xl"
            style={{
              borderColor:
                payload.variant === "message"
                  ? "rgba(129,140,248,0.35)"
                  : payload.variant === "scheduled_call"
                    ? "rgba(34,211,238,0.35)"
                    : "rgba(244,114,182,0.3)",
              background:
                "linear-gradient(155deg,rgba(15,12,28,0.97) 0%,rgba(8,6,18,0.98) 100%)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
            }}
          >
            <div className="px-4 py-3.5">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: "rgba(255,255,255,0.12)",
                    background: "rgba(129,140,248,0.12)",
                  }}
                >
                  {payload.variant === "message" ? (
                    <MessageCircle className="h-4 w-4 text-indigo-300" aria-hidden />
                  ) : payload.variant === "scheduled_call" ? (
                    <PhoneForwarded className="h-4 w-4 text-cyan-300" aria-hidden />
                  ) : payload.variant === "task" ? (
                    <CheckSquare className="h-4 w-4 text-pink-300" aria-hidden />
                  ) : (
                    <Bell className="h-4 w-4 text-amber-300" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    {payload.variant === "message"
                      ? "Сообщение отправлено"
                      : payload.variant === "scheduled_call"
                        ? "Созвон в чате"
                        : payload.variant === "task"
                          ? "Задача на борде"
                          : "В плане"}
                  </p>
                  <p className="truncate text-[15px] font-semibold leading-tight text-white/95">{payload.line1}</p>
                </div>
              </div>
              {payload.line2 ? (
                payload.variant === "message" ? (
                  <div
                    className="rounded-xl border border-white/10 px-3 py-2.5 text-[14px] leading-snug text-white/88"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    {payload.line2}
                  </div>
                ) : (
                  <p className="text-[12px] leading-snug text-white/55">{payload.line2}</p>
                )
              ) : null}
              <p className="mt-2.5 text-center text-[11px] text-white/35">
                {payload.target === "chats" ? "→ в чаты" : "→ на борд"}
              </p>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}
