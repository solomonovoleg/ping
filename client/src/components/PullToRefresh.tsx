import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";

const PULL_THRESHOLD = 72;
const RESISTANCE = 0.4;
const SCROLL_TO_TOP_SHOW_AFTER_PX = 400;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Показывать кнопку «Наверх» после скролла вниз (аудит п.26) */
  showScrollToTop?: boolean;
  /** Внешний ref на скролл-контейнер, если нужно управлять scrollTop извне (например, сохранять позицию ленты). */
  scrollRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Оборачивает скролл-область: при тяге вниз с вершины списка вызывается onRefresh (аудит п.7, п.24).
 */
export function PullToRefresh({ onRefresh, children, className, disabled, showScrollToTop, scrollRef }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showToTop, setShowToTop] = useState(false);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const effectiveScrollRef = scrollRef ?? internalScrollRef;
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);

  useEffect(() => {
    if (!showScrollToTop) return;
    const el = effectiveScrollRef.current;
    if (!el) return;
    const check = () => setShowToTop(el.scrollTop > SCROLL_TO_TOP_SHOW_AFTER_PX);
    el.addEventListener("scroll", check, { passive: true });
    check();
    return () => el.removeEventListener("scroll", check);
  }, [showScrollToTop]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startYRef.current = e.touches[0].clientY;
    startScrollTopRef.current = effectiveScrollRef.current?.scrollTop ?? 0;
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const scrollTop = effectiveScrollRef.current?.scrollTop ?? 0;
    if (scrollTop > 2) return;
    const y = e.touches[0].clientY;
    const delta = y - startYRef.current;
    if (delta <= 0) return;
    const resisted = Math.min(delta * RESISTANCE, delta);
    setPullY(resisted);
  }, [disabled, refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (refreshing) return;
    if (pullY >= PULL_THRESHOLD) {
      triggerSelectionHaptic();
      setPullY(0);
      setRefreshing(true);
      Promise.resolve(onRefresh())
        .finally(() => setRefreshing(false));
    } else {
      setPullY(0);
    }
  }, [onRefresh, pullY, refreshing]);

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 min-w-0", className)}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{
          height: refreshing ? 48 : Math.min(pullY, PULL_THRESHOLD),
          minHeight: 0,
        }}
      >
        {refreshing ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
        ) : pullY > 16 ? (
          <Loader2
            className="w-5 h-5 text-muted-foreground transition-opacity"
            style={{ opacity: Math.min(1, pullY / PULL_THRESHOLD) }}
            aria-hidden
          />
        ) : null}
      </div>
      <div
        ref={effectiveScrollRef}
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
      {showScrollToTop && showToTop && (
        <button
          type="button"
          onClick={() => effectiveScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-24 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
          style={{ bottom: "max(5rem, calc(var(--uix-nav-bottom) + var(--uix-space-2)))" }}
          aria-label="Наверх"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
