import { useEffect, useRef, type RefObject } from "react";

const HOLD_MS = 2000;
const DOUBLE_TAP_MS = 320;
/** Движение до активации удержания — отмена таймера (скролл ленты). */
const MOVE_CANCEL_BEFORE_HOLD_PX = 14;
/** После удержания: палец выше старта на столько px → ×3, иначе ×2. */
const DRAG_UP_FOR_3X_PX = 10;

type Options = {
  enabled: boolean;
  reducedMotion: boolean;
  onDoubleTap: () => void;
  /** Смена источника — переподписка на новый элемент. */
  srcKey: string;
};

/**
 * Жесты «как в рилсах» на элементе video:
 * - двойной тап → callback (например реакция 🔥);
 * - удержание ≥2 с → playbackRate 2; если потянуть вверх ≥10 px от точки нажатия → 3, вернуть палец ниже порога → снова 2;
 * - отпускание → playbackRate 1.
 */
export function useReelsFeedVideoGestures(videoRef: RefObject<HTMLVideoElement | null>, options: Options) {
  const { enabled, reducedMotion, onDoubleTap, srcKey } = options;
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enabled || reducedMotion) return;

    const lastTapEndRef = { current: 0 };
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdActive = false;
    let startY = 0;
    let startX = 0;
    let pointerDown = false;

    const clearHoldTimer = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
    };

    const resetSpeed = () => {
      holdActive = false;
      v.playbackRate = 1;
      clearHoldTimer();
    };

    const applyRateFromClientY = (clientY: number) => {
      if (!holdActive) return;
      const up = startY - clientY;
      v.playbackRate = up >= DRAG_UP_FOR_3X_PX ? 3 : 2;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDown = true;
      startX = e.clientX;
      startY = e.clientY;
      clearHoldTimer();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!pointerDown) return;
        if (v.paused) return;
        holdActive = true;
        v.playbackRate = 2;
        applyRateFromClientY(startY);
      }, HOLD_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      if (!holdActive && (dx > MOVE_CANCEL_BEFORE_HOLD_PX || dy > MOVE_CANCEL_BEFORE_HOLD_PX)) {
        clearHoldTimer();
      }
      applyRateFromClientY(e.clientY);
    };

    const onPointerUp = () => {
      pointerDown = false;
      if (holdActive) {
        resetSpeed();
        return;
      }
      clearHoldTimer();
      const now = Date.now();
      if (now - lastTapEndRef.current < DOUBLE_TAP_MS) {
        onDoubleTapRef.current();
        lastTapEndRef.current = 0;
      } else {
        lastTapEndRef.current = now;
      }
    };

    v.addEventListener("pointerdown", onPointerDown);
    v.addEventListener("pointermove", onPointerMove);
    v.addEventListener("pointerup", onPointerUp);
    v.addEventListener("pointercancel", onPointerUp);
    v.addEventListener("lostpointercapture", onPointerUp);

    return () => {
      pointerDown = false;
      clearHoldTimer();
      v.playbackRate = 1;
      v.removeEventListener("pointerdown", onPointerDown);
      v.removeEventListener("pointermove", onPointerMove);
      v.removeEventListener("pointerup", onPointerUp);
      v.removeEventListener("pointercancel", onPointerUp);
      v.removeEventListener("lostpointercapture", onPointerUp);
    };
  }, [enabled, reducedMotion, srcKey, videoRef]);
}
