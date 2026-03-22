import { createPortal } from "react-dom";
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DURATION_NORMAL_S,
  DURATION_TOAST_AUTO_DISMISS_MS,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

export type PinFolderDescriptionBubblePayload = {
  title: string;
  body: string;
  clientX: number;
  clientY: number;
} | null;

function clampBubblePosition(clientX: number, clientY: number): { left: number; top: number } {
  if (typeof window === "undefined") return { left: clientX, top: clientY - 10 };
  const pad = 12;
  const halfW = 118;
  const x = Math.min(Math.max(clientX, pad + halfW), window.innerWidth - pad - halfW);
  const y = Math.min(Math.max(clientY, 72), window.innerHeight - pad);
  return { left: x, top: y - 10 };
}

/**
 * Мини-подсказка рядом с папкой закреплённого при удержании: полупрозрачная, как лёгкий тост.
 */
export function PinFolderDescriptionBubble({
  payload,
  onDismiss,
}: {
  payload: PinFolderDescriptionBubblePayload;
  onDismiss: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  const pos = useMemo(
    () => (payload ? clampBubblePosition(payload.clientX, payload.clientY) : null),
    [payload],
  );

  useEffect(() => {
    if (!payload) return;
    const t = window.setTimeout(onDismiss, DURATION_TOAST_AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [payload, onDismiss]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {payload && pos ? (
        <motion.div
          key={`${payload.title}-${payload.clientX}-${payload.clientY}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: reduced ? 0.1 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
          className="pointer-events-none fixed z-[325] max-w-[min(236px,calc(100vw-24px))] -translate-x-1/2 -translate-y-full rounded-xl border border-white/14 bg-neutral-950/68 px-3 py-2 shadow-lg backdrop-blur-md"
          style={{ left: pos.left, top: pos.top }}
        >
          <div className="text-[11px] font-semibold tracking-tight text-white/95">{payload.title}</div>
          <p className="mt-0.5 max-h-[112px] overflow-y-auto text-[11px] leading-snug text-white/76">{payload.body}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
