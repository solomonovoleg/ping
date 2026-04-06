import { type RefObject, useLayoutEffect, useRef } from "react";
import {
  chatBackSwipeShouldCancelAsVerticalScroll,
  chatBackSwipeShouldCommitSwipeRight,
} from "@/lib/touch-edge-swipe-physics";

function isChatSwipeBackExcludedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("[data-chat-swipe-back-ignore]")) return true;
  if (target.closest("textarea, input, select, button, a[href], [role='slider'], [contenteditable='true']")) {
    return true;
  }
  return false;
}

/**
 * Короткий свайп слева направо по поверхности открытого чата → список чатов.
 * Старт с любой точки (кроме пузыря, поля ввода, кнопок и ссылок).
 */
export function useChatEdgeSwipeBack(opts: {
  enabled: boolean;
  blocked: boolean;
  onBack: () => void;
  surfaceRef: RefObject<HTMLElement | null>;
  /** Смена корневого div (loading / error / основной экран) — перепривязать слушатели. */
  surfaceGeneration: number;
}) {
  const onBackRef = useRef(opts.onBack);
  onBackRef.current = opts.onBack;
  const enabledRef = useRef(opts.enabled);
  enabledRef.current = opts.enabled;
  const blockedRef = useRef(opts.blocked);
  blockedRef.current = opts.blocked;

  useLayoutEffect(() => {
    const el = opts.surfaceRef.current;
    if (!el) return;

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
      if (isChatSwipeBackExcludedTarget(e.target)) return;

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
      if (chatBackSwipeShouldCancelAsVerticalScroll(startX, startY, e.clientX, e.clientY)) {
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
      if (chatBackSwipeShouldCommitSwipeRight(startX, endX, lastX, lastT, endT, t0)) {
        onBackRef.current();
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) reset();
    };

    el.addEventListener("pointerdown", onPointerDown, true);
    el.addEventListener("pointermove", onPointerMove, true);
    el.addEventListener("pointerup", onPointerUp, true);
    el.addEventListener("pointercancel", onPointerCancel, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown, true);
      el.removeEventListener("pointermove", onPointerMove, true);
      el.removeEventListener("pointerup", onPointerUp, true);
      el.removeEventListener("pointercancel", onPointerCancel, true);
      reset();
    };
  }, [opts.surfaceRef, opts.surfaceGeneration]);
}
