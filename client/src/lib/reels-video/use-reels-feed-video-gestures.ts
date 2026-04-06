import { useEffect, useRef, type RefObject } from "react";

/** Полноэкранные рилсы: ускорение ×2 после удержания (ближе к Instagram Reels, чем 1.5 с). */
const HOLD_MS_REELS = 1000;
/** Общее окно с двойным тапом по фото в ленте (`feed-double-tap-image-layer`). */
export const REELS_FEED_DOUBLE_TAP_MS = 320;
/**
 * Порог движения для двойного тапа по фото в ленте.
 * Синхронизирован с видео: слишком узкий slop давал ложные cancelledByMove и сбрасывал окно двойного тапа.
 */
export const REELS_FEED_TAP_MOVE_SLOP_PX = 28;
/** Видео в ленте: тот же slop, что и у фото. */
const FEED_VIDEO_MOVE_SLOP_PX = REELS_FEED_TAP_MOVE_SLOP_PX;
const DOUBLE_TAP_MS = REELS_FEED_DOUBLE_TAP_MS;
/** Лента: небольшая задержка открытия рилсов, чтобы успеть распознать double tap как лайк. */
const FEED_TAP_OPEN_REELS_MS = 220;
/** Окно второго тапа в ленте (как у фото, {@link REELS_FEED_DOUBLE_TAP_MS}), иначе лайк на видео «не ловится». */
const FEED_DOUBLE_TAP_WINDOW_MS = REELS_FEED_DOUBLE_TAP_MS;
/** После удержания: палец выше старта на столько px → ×3, ниже — снова ×2. */
const DRAG_UP_FOR_3X_PX = 10;
/** Рилсы: вертикаль жеста — смена ролика, отмена ожидания ускорения. */
const REELS_PREHOLD_VERTICAL_CANCEL_PX = 48;
/** Рилсы: явный горизонтальный жест — свайп навигации / отмена ускорения. */
const REELS_PREHOLD_HORIZONTAL_CANCEL_PX = 36;
const REELS_SWIPE_COMMIT_PX = 56;
const REELS_SWIPE_DOMINANCE_BIAS = 14;

type GestureMode = "feed" | "reels";

type Options = {
  enabled: boolean;
  onDoubleTap: () => void;
  /** Смена источника — переподписка на новый элемент. */
  srcKey: string;
  /** Ускорение по удержанию: 1 — отпустили, 2 / 3 — множитель. */
  onHoldSpeed?: (rate: 1 | 2 | 3) => void;
  /**
   * Лента: одиночный тап → через ~220 ms открыть рилсы (если за это время не было второго тапа = лайк).
   * Рилсы полноэкранно: пауза по тапу, окно двойного тапа {@link REELS_FEED_DOUBLE_TAP_MS}.
   */
  onSingleTapDeferred?: () => void;
  /** `feed` — прежняя логика; `reels` — удержание ~1 с → ×2, свайпы влево/вправо. */
  gestureMode?: GestureMode;
  /** Полноэкранные рилсы: свайп влево (dx &lt; 0) — например к ленте постов. */
  onSwipeLeft?: () => void;
  /** Полноэкранные рилсы: свайп вправо — например в профиль. */
  onSwipeRight?: () => void;
  /** Рилсы: вошли в режим ускорения по удержанию (×2) — тактильный отклик. */
  onReelsHoldEngaged?: () => void;
};

/**
 * Жесты в ленте и в рилсах (целевой DOM — `<video>` или прозрачный слой над ним в ленте):
 * - **feed**: двойной тап — лайк; одиночный тап — открыть рилсы после короткого окна double tap.
 * - **reels**: удержание ~1 с → ×2; удерживая — вверх ×3, вниз снова ×2; отпускание → ×1; двойной тап;
 *   горизонтальный свайп — `onSwipeLeft` / `onSwipeRight`.
 *
 * `playbackVideoRef` — элемент для `playbackRate` / play в режиме рилсов; в ленте с оверлеем не передаётся.
 */
export function useReelsFeedVideoGestures(
  gestureTargetRef: RefObject<HTMLElement | null>,
  options: Options & { playbackVideoRef?: RefObject<HTMLVideoElement | null> | null },
) {
  const {
    enabled,
    onDoubleTap,
    srcKey,
    onHoldSpeed,
    onSingleTapDeferred,
    gestureMode = "feed",
    onSwipeLeft,
    onSwipeRight,
    onReelsHoldEngaged,
    playbackVideoRef = null,
  } = options;
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;
  const onHoldSpeedRef = useRef(onHoldSpeed);
  onHoldSpeedRef.current = onHoldSpeed;
  const onSingleTapDeferredRef = useRef(onSingleTapDeferred);
  onSingleTapDeferredRef.current = onSingleTapDeferred;
  const gestureModeRef = useRef(gestureMode);
  gestureModeRef.current = gestureMode;
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;
  const onReelsHoldEngagedRef = useRef(onReelsHoldEngaged);
  onReelsHoldEngagedRef.current = onReelsHoldEngaged;
  const playbackRef = useRef(playbackVideoRef);
  playbackRef.current = playbackVideoRef;

  useEffect(() => {
    const el = gestureTargetRef.current;
    if (!el || !enabled) return;

    const lastTapEndRef = { current: 0 };
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let holdActive = false;
    let startY = 0;
    let startX = 0;
    let pointerDown = false;
    let cancelledByMove = false;
    let singleTapTimer: ReturnType<typeof setTimeout> | null = null;

    const clearSingleTapTimer = () => {
      if (singleTapTimer) clearTimeout(singleTapTimer);
      singleTapTimer = null;
    };

    const clearHoldTimer = () => {
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
    };

    const resetSpeed = () => {
      holdActive = false;
      const pv = playbackRef.current?.current;
      if (pv) pv.playbackRate = 1;
      clearHoldTimer();
      onHoldSpeedRef.current?.(1);
    };

    const applyRateFromClientY = (clientY: number) => {
      if (!holdActive) return;
      const pv = playbackRef.current?.current;
      if (!pv) return;
      const up = startY - clientY;
      const rate = up >= DRAG_UP_FOR_3X_PX ? 3 : 2;
      pv.playbackRate = rate;
      onHoldSpeedRef.current?.(rate);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      pointerDown = true;
      cancelledByMove = false;
      startX = e.clientX;
      startY = e.clientY;
      clearSingleTapTimer();
      clearHoldTimer();
      const mode = gestureModeRef.current;
      if (mode !== "reels") return;
      holdTimer = setTimeout(() => {
        holdTimer = null;
        if (!pointerDown) return;
        holdActive = true;
        onReelsHoldEngagedRef.current?.();
        const pv = playbackRef.current?.current;
        if (!pv) return;
        if (pv.paused) void pv.play().catch(() => {});
        pv.playbackRate = 2;
        applyRateFromClientY(startY);
      }, HOLD_MS_REELS);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const mode = gestureModeRef.current;
      const rdx = e.clientX - startX;
      const rdy = e.clientY - startY;
      const adx = Math.abs(rdx);
      const ady = Math.abs(rdy);

      if (mode === "feed") {
        const moveSlop = FEED_VIDEO_MOVE_SLOP_PX;
        if (adx > moveSlop || ady > moveSlop) {
          cancelledByMove = true;
          clearSingleTapTimer();
        }
      } else {
        if (!holdActive) {
          if (ady > REELS_PREHOLD_VERTICAL_CANCEL_PX && ady > adx + 12) {
            clearHoldTimer();
            cancelledByMove = true;
            clearSingleTapTimer();
          }
          if (adx > REELS_PREHOLD_HORIZONTAL_CANCEL_PX && adx > ady + 12) {
            clearHoldTimer();
            cancelledByMove = true;
            clearSingleTapTimer();
          }
        }
      }
      applyRateFromClientY(e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointerDown = false;
      if (holdActive) {
        resetSpeed();
        return;
      }
      clearHoldTimer();

      const mode = gestureModeRef.current;
      const totalDx = e.clientX - startX;
      const totalDy = e.clientY - startY;
      const adx = Math.abs(totalDx);
      const ady = Math.abs(totalDy);

      if (
        mode === "reels" &&
        adx >= REELS_SWIPE_COMMIT_PX &&
        adx > ady + REELS_SWIPE_DOMINANCE_BIAS
      ) {
        if (totalDx < 0) {
          onSwipeLeftRef.current?.();
        } else {
          onSwipeRightRef.current?.();
        }
        cancelledByMove = false;
        clearSingleTapTimer();
        lastTapEndRef.current = 0;
        return;
      }

      if (cancelledByMove) {
        cancelledByMove = false;
        clearSingleTapTimer();
        /* Видео: сброс окна — иначе следующий одиночный тап в течение 300ms шёл в ветку «двойной» и рилсы не открывались. */
        lastTapEndRef.current = 0;
        return;
      }

      const now = Date.now();

      if (mode === "feed" && onSingleTapDeferredRef.current) {
        if (now - lastTapEndRef.current < FEED_DOUBLE_TAP_WINDOW_MS) {
          clearSingleTapTimer();
          onDoubleTapRef.current();
          lastTapEndRef.current = 0;
        } else {
          lastTapEndRef.current = now;
          clearSingleTapTimer();
          singleTapTimer = setTimeout(() => {
            singleTapTimer = null;
            onSingleTapDeferredRef.current?.();
            lastTapEndRef.current = 0;
          }, FEED_TAP_OPEN_REELS_MS);
        }
        return;
      }

      if (now - lastTapEndRef.current < DOUBLE_TAP_MS) {
        clearSingleTapTimer();
        onDoubleTapRef.current();
        lastTapEndRef.current = 0;
      } else {
        lastTapEndRef.current = now;
        clearSingleTapTimer();
        if (onSingleTapDeferredRef.current) {
          singleTapTimer = setTimeout(() => {
            singleTapTimer = null;
            onSingleTapDeferredRef.current?.();
            lastTapEndRef.current = 0;
          }, DOUBLE_TAP_MS);
        }
      }
    };

    const onPointerInterrupt = () => {
      pointerDown = false;
      if (holdActive) {
        resetSpeed();
        return;
      }
      clearHoldTimer();
      cancelledByMove = false;
      clearSingleTapTimer();
      lastTapEndRef.current = 0;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerInterrupt);
    el.addEventListener("lostpointercapture", onPointerInterrupt);

    return () => {
      pointerDown = false;
      clearSingleTapTimer();
      clearHoldTimer();
      const pv = playbackRef.current?.current;
      if (pv) pv.playbackRate = 1;
      onHoldSpeedRef.current?.(1);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerInterrupt);
      el.removeEventListener("lostpointercapture", onPointerInterrupt);
    };
  }, [enabled, srcKey, gestureTargetRef, gestureMode]);
}
