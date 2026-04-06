import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { DURATION_NORMAL_MS, EASING_OUT, usePrefersReducedMotion } from "@/lib/motion";
import { usePreferPhoneChrome } from "@/hooks/use-prefer-phone-chrome";

const PULL_THRESHOLD = 72;
const RESISTANCE = 0.4;

function findVerticalScrollParent(start: Element | null): HTMLElement | null {
  let node: Element | null = start;
  while (node && node !== document.documentElement) {
    if (node instanceof HTMLElement) {
      const s = getComputedStyle(node);
      const oy = s.overflowY;
      const ovf = s.overflow;
      const scrollableY =
        (oy === "auto" || oy === "scroll" || ovf === "auto" || ovf === "scroll") &&
        node.scrollHeight > node.clientHeight + 2;
      if (scrollableY) return node;
    }
    node = node.parentElement;
  }
  const root = document.documentElement;
  if (root.scrollHeight > root.clientHeight + 2) return root;
  return null;
}

function resolveScrollRoot(touchTarget: Element | null, mainEl: HTMLElement | null): HTMLElement | null {
  const fromTarget = findVerticalScrollParent(touchTarget);
  if (fromTarget) return fromTarget;
  if (mainEl && mainEl.scrollHeight > mainEl.clientHeight + 2) return mainEl;
  return null;
}

/**
 * Pull-to-refresh для экранов без собственного `PullToRefresh`: жест с вершины скролла,
 * плавный индикатор, `invalidateQueries({ refetchType: 'active' })`.
 * Страницы с `data-pull-refresh-scope` полностью исключаются (у них свой PTR).
 */
export function GlobalPullToRefresh({
  disabled,
  mainRef,
}: {
  disabled?: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const preferPhoneChrome = usePreferPhoneChrome();
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  refreshingRef.current = refreshing;
  const pullYRef = useRef(0);
  pullYRef.current = pullY;
  const startYRef = useRef(0);
  const scrollElRef = useRef<HTMLElement | null>(null);
  const skipGestureRef = useRef(false);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ refetchType: "active" });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (disabled || typeof document === "undefined") return;

    const touchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const touchEl = e.target instanceof Element ? e.target : null;
      if (touchEl?.closest("[data-pull-refresh-scope]")) {
        skipGestureRef.current = true;
        scrollElRef.current = null;
        return;
      }
      if (touchEl?.closest('[aria-modal="true"]')) {
        skipGestureRef.current = true;
        scrollElRef.current = null;
        return;
      }
      skipGestureRef.current = false;
      startYRef.current = t.clientY;
      scrollElRef.current = resolveScrollRoot(touchEl, mainRef.current);
    };

    const touchMove = (e: TouchEvent) => {
      if (refreshingRef.current || skipGestureRef.current) return;
      const el = scrollElRef.current;
      if (!el) return;
      if (el.scrollTop > 2) return;
      const t = e.touches[0];
      if (!t) return;
      const delta = t.clientY - startYRef.current;
      if (delta <= 0) return;
      const resisted = Math.min(delta * RESISTANCE, delta);
      if (el.scrollTop <= 0 && delta > 0) {
        e.preventDefault();
      }
      setPullY(resisted);
    };

    const touchEnd = () => {
      if (skipGestureRef.current) {
        skipGestureRef.current = false;
        scrollElRef.current = null;
        setPullY(0);
        return;
      }
      scrollElRef.current = null;
      if (refreshingRef.current) return;
      const py = pullYRef.current;
      if (py >= PULL_THRESHOLD) {
        void triggerSelectionHaptic();
        setPullY(0);
        void runRefresh();
      } else {
        setPullY(0);
      }
    };

    document.addEventListener("touchstart", touchStart, { capture: true, passive: true });
    document.addEventListener("touchmove", touchMove, { capture: true, passive: false });
    document.addEventListener("touchend", touchEnd, { capture: true });
    document.addEventListener("touchcancel", touchEnd, { capture: true });

    return () => {
      document.removeEventListener("touchstart", touchStart, { capture: true });
      document.removeEventListener("touchmove", touchMove, { capture: true });
      document.removeEventListener("touchend", touchEnd, { capture: true });
      document.removeEventListener("touchcancel", touchEnd, { capture: true });
    };
  }, [disabled, mainRef, runRefresh]);

  const showBar = pullY > 6 || refreshing;
  const barH = refreshing ? 44 : Math.min(pullY, PULL_THRESHOLD);
  const progress = Math.min(1, pullY / PULL_THRESHOLD);

  return (
    <div
      className={cn(
        "pointer-events-none fixed left-0 right-0 z-[44] flex flex-col items-center justify-end bg-gradient-to-b from-background/85 to-transparent pb-1 backdrop-blur-[2px] transition-opacity",
        preferPhoneChrome && "left-1/2 right-auto w-full max-w-[480px] -translate-x-1/2",
        showBar ? "opacity-100" : "opacity-0"
      )}
      style={{
        top: 0,
        paddingTop: "max(4px, env(safe-area-inset-top, 0px))",
        height: `calc(max(4px, env(safe-area-inset-top, 0px)) + ${barH}px)`,
        transitionProperty: prefersReducedMotion ? "opacity" : "opacity, height",
        transitionDuration: `${prefersReducedMotion ? 120 : DURATION_NORMAL_MS}ms`,
        transitionTimingFunction: EASING_OUT,
      }}
      aria-hidden={!refreshing}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {refreshing ? "Обновление…" : ""}
      </span>
      <div className="flex h-8 items-center justify-center">
        {refreshing ? (
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        ) : (
          <Loader2
            className="h-5 w-5 text-primary"
            style={{
              opacity: progress,
              transform: prefersReducedMotion ? undefined : `rotate(${progress * 220}deg)`,
              transition: prefersReducedMotion ? undefined : "transform 120ms ease-out",
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
