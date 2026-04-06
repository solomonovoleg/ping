import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { isNative } from "@/lib/capacitor-native";
import {
  EDGE_SWIPE,
  edgeNavLeftZonePx,
  edgeNavRightZonePx,
  edgeNavSwipeShouldCancelAsVerticalScroll,
  edgeSwipeShouldCommitSwipeLeft,
  edgeSwipeShouldCommitSwipeRight,
} from "@/lib/touch-edge-swipe-physics";

type EdgeSwipeOpts = {
  enabled: boolean;
  blocked: boolean;
  onNavigate: () => void;
};

/**
 * Когда включать краевую навигацию: узкий viewport, нативное приложение (в т.ч. планшет ≥768),
 * или основной указатель «грубый» (тач в браузере на планшете).
 */
export function useTouchEdgeNavigationEnabled(): boolean {
  const isMobile = useIsMobile();
  const [coarsePointer, setCoarsePointer] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const onChange = () => setCoarsePointer(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile || isNative() || coarsePointer;
}

/**
 * Touch: старт у левого края → свайп вправо → callback.
 * Верх экрана исключён (шапки). Не мышь.
 */
export function useTouchLeftEdgeSwipeRight(opts: EdgeSwipeOpts) {
  const onNavigateRef = useRef(opts.onNavigate);
  onNavigateRef.current = opts.onNavigate;
  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const blockedRef = useRef(opts.blocked);
  blockedRef.current = opts.blocked;

  useEffect(() => {
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let startTime = 0;
    let pointerId: number | null = null;

    const reset = () => {
      tracking = false;
      pointerId = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current || blockedRef.current) return;
      if (e.pointerType === "mouse") return;
      if (e.button !== 0) return;
      if (e.clientX > edgeNavLeftZonePx()) return;
      if (e.clientY < EDGE_SWIPE.topExcludePx) return;

      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      const now = performance.now();
      startTime = now;
      lastX = startX;
      lastT = now;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      if (edgeNavSwipeShouldCancelAsVerticalScroll(startX, startY, e.clientX, e.clientY)) {
        reset();
        return;
      }
      lastX = e.clientX;
      lastT = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      const endX = e.clientX;
      const endT = performance.now();
      const t0 = startTime;
      reset();
      if (edgeSwipeShouldCommitSwipeRight(startX, endX, lastX, lastT, endT, t0)) {
        onNavigateRef.current();
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) reset();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      reset();
    };
  }, []);
}

/**
 * Touch: старт у правого края → свайп влево → callback.
 * Верх экрана исключён. Не мышь.
 */
export function useTouchRightEdgeSwipeLeft(opts: EdgeSwipeOpts) {
  const onNavigateRef = useRef(opts.onNavigate);
  onNavigateRef.current = opts.onNavigate;
  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const blockedRef = useRef(opts.blocked);
  blockedRef.current = opts.blocked;

  useEffect(() => {
    let tracking = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let startTime = 0;
    let pointerId: number | null = null;

    const reset = () => {
      tracking = false;
      pointerId = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current || blockedRef.current) return;
      if (e.pointerType === "mouse") return;
      if (e.button !== 0) return;
      const vw = window.innerWidth;
      const zone = edgeNavRightZonePx();
      if (vw <= 0 || e.clientX < vw - zone) return;
      if (e.clientY < EDGE_SWIPE.topExcludePx) return;

      tracking = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      const now = performance.now();
      startTime = now;
      lastX = startX;
      lastT = now;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      if (edgeNavSwipeShouldCancelAsVerticalScroll(startX, startY, e.clientX, e.clientY)) {
        reset();
        return;
      }
      lastX = e.clientX;
      lastT = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      const endX = e.clientX;
      const endT = performance.now();
      const t0 = startTime;
      reset();
      if (edgeSwipeShouldCommitSwipeLeft(startX, endX, lastX, lastT, endT, t0)) {
        onNavigateRef.current();
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) reset();
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      reset();
    };
  }, []);
}
