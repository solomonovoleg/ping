import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION_FAST_MS, EASING_OUT, usePrefersReducedMotion } from "@/lib/motion";
import { REELS_FEED_DOUBLE_TAP_MS, REELS_FEED_TAP_MOVE_SLOP_PX } from "./use-reels-feed-video-gestures";

/** Лёгкий «отскок» масштаба медиа при двойном тапе (Web Animations API, без лишнего слоя в DOM). */
function runMediaDoubleTapPulse(el: HTMLElement, durationMs: number): void {
  if (typeof el.animate !== "function") return;
  try {
    for (const a of el.getAnimations()) {
      a.cancel();
    }
    el.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.038)" }, { transform: "scale(1)" }],
      { duration: durationMs, easing: EASING_OUT },
    );
  } catch {
    /* ignore */
  }
}

type FeedDoubleTapImageLayerProps = {
  /** Двойной тап — лайк (как на видео в ленте). Одиночный тап не обрабатываем. */
  onDoubleTap: () => void;
  className?: string;
  children: ReactNode;
  /**
   * Лёгкий пульс масштаба при срабатывании (фото/коллаж в ленте).
   * Для текста подписи передавайте false — иначе дёргается весь абзац.
   */
  pulseOnDoubleTap?: boolean;
};

/**
 * Фото в ленте: двойной тап = лайк; движение ≥ slop = скролл, без ложных лайков.
 * Дочерний `img` должен быть с `pointer-events-none`, иначе события уйдут в картинку.
 */
export function FeedDoubleTapImageLayer({
  onDoubleTap,
  className,
  children,
  pulseOnDoubleTap = true,
}: FeedDoubleTapImageLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  const pulseRef = useRef(pulseOnDoubleTap);
  pulseRef.current = pulseOnDoubleTap;
  const reducedMotion = usePrefersReducedMotion();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const lastTapEndRef = { current: 0 };
    let pointerDown = false;
    let startX = 0;
    let startY = 0;
    let cancelledByMove = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDown = true;
      cancelledByMove = false;
      startX = e.clientX;
      startY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (dx > REELS_FEED_TAP_MOVE_SLOP_PX || dy > REELS_FEED_TAP_MOVE_SLOP_PX) {
        cancelledByMove = true;
      }
    };

    const onPointerUp = () => {
      if (!pointerDown) return;
      pointerDown = false;
      if (cancelledByMove) {
        /* Не сбрасываем lastTapEnd: лёгкий сдвиг на втором касании иначе убивает пару с первым тапом. */
        return;
      }
      const now = Date.now();
      if (now - lastTapEndRef.current < REELS_FEED_DOUBLE_TAP_MS) {
        onDoubleTapRef.current();
        if (pulseRef.current && !reducedRef.current) {
          runMediaDoubleTapPulse(el, DURATION_FAST_MS + 110);
        }
        lastTapEndRef.current = 0;
      } else {
        lastTapEndRef.current = now;
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("lostpointercapture", onPointerUp);

    return () => {
      pointerDown = false;
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("lostpointercapture", onPointerUp);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("touch-manipulation origin-center", className)}>
      {children}
    </div>
  );
}
