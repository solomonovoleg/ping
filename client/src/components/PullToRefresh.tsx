import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/lib/capacitor-native";

const PULL_THRESHOLD = 72;
const RESISTANCE = 0.4;
const SCROLL_TO_TOP_SHOW_AFTER_PX = 400;
const HOLD_TO_REFRESH_MS = 2000;

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  /** Вызывается при отпускании жеста, если тяга дошла до порога (вместе с обновлением списка). */
  onPastThresholdRelease?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  /** Удержание тяги у порога без отпускания: авто-обновление (по умолчанию включено). */
  enableHoldRefresh?: boolean;
  /**
   * Удержание тяги вниз у порога дольше этого времени (мс) — отдельное действие (например, скрытые чаты).
   * Не вызывает onRefresh при срабатывании.
   */
  holdRevealMs?: number;
  onHoldReveal?: () => void;
  /** Показывать кнопку «Наверх» после скролла вниз (аудит п.26) */
  showScrollToTop?: boolean;
  /** Внешний ref на скролл-контейнер, если нужно управлять scrollTop извне (например, сохранять позицию ленты). */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * Фиксированный оверлей под скроллом (z-20): при pull-to-refresh не «уезжает» вместе с контентом.
   * Скролл задаётся с `scrollPaddingTopPx`, чтобы контент заходил на обложку; фон скролла прозрачный в зоне padding.
   */
  overlayTop?: React.ReactNode;
  /** Высота оверлея в px (по умолчанию 133 — профиль PULSE). */
  overlayTopHeightPx?: number;
  /** Верхний padding скролла (например под нахлёст карточки на обложку). */
  scrollPaddingTopPx?: number;
}

/**
 * Оборачивает скролл-область: при тяге вниз с вершины списка вызывается onRefresh (аудит п.7, п.24).
 */
export function PullToRefresh({
  onRefresh,
  onPastThresholdRelease,
  children,
  className,
  disabled,
  enableHoldRefresh = true,
  holdRevealMs,
  onHoldReveal,
  showScrollToTop,
  scrollRef,
  overlayTop,
  overlayTopHeightPx = 133,
  scrollPaddingTopPx = 0,
}: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showToTop, setShowToTop] = useState(false);
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const effectiveScrollRef = scrollRef ?? internalScrollRef;
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRevealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealFiredRef = useRef(false);

  useEffect(() => {
    if (!showScrollToTop) return;
    const el = effectiveScrollRef.current;
    if (!el) return;
    const check = () => setShowToTop(el.scrollTop > SCROLL_TO_TOP_SHOW_AFTER_PX);
    el.addEventListener("scroll", check, { passive: true });
    check();
    return () => el.removeEventListener("scroll", check);
  }, [showScrollToTop]);

  /** При удержании тяги вниз 2 сек — обновление без отпускания */
  useEffect(() => {
    if (!enableHoldRefresh || refreshing || pullY < PULL_THRESHOLD) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      return;
    }
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      triggerSelectionHaptic();
      setPullY(0);
      setRefreshing(true);
      Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
    }, HOLD_TO_REFRESH_MS);
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [pullY, refreshing, onRefresh, enableHoldRefresh]);

  /** Удержание у порога дольше — скрытые чаты и т.п. */
  useEffect(() => {
    if (!holdRevealMs || !onHoldReveal || refreshing || pullY < PULL_THRESHOLD) {
      if (holdRevealTimerRef.current) {
        clearTimeout(holdRevealTimerRef.current);
        holdRevealTimerRef.current = null;
      }
      return;
    }
    holdRevealTimerRef.current = setTimeout(() => {
      holdRevealTimerRef.current = null;
      revealFiredRef.current = true;
      void triggerLightHaptic();
      setPullY(0);
      onHoldReveal();
    }, holdRevealMs);
    return () => {
      if (holdRevealTimerRef.current) clearTimeout(holdRevealTimerRef.current);
    };
  }, [pullY, refreshing, holdRevealMs, onHoldReveal]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    revealFiredRef.current = false;
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
    if (revealFiredRef.current) {
      revealFiredRef.current = false;
      setPullY(0);
      return;
    }
    if (pullY >= PULL_THRESHOLD) {
      onPastThresholdRelease?.();
      triggerSelectionHaptic();
      setPullY(0);
      setRefreshing(true);
      Promise.resolve(onRefresh())
        .finally(() => setRefreshing(false));
    } else {
      setPullY(0);
    }
  }, [onRefresh, onPastThresholdRelease, pullY, refreshing]);

  return (
    <div className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      {overlayTop ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 isolate"
          style={{ height: overlayTopHeightPx }}
        >
          <div className="pointer-events-auto h-full">{overlayTop}</div>
        </div>
      ) : null}
      <div
        className="relative z-[22] flex shrink-0 items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{
          height: refreshing ? 48 : Math.min(pullY, PULL_THRESHOLD),
          minHeight: 0,
        }}
      >
        {refreshing ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary" aria-hidden />
        ) : pullY > 16 ? (
          <div className="flex flex-col items-center gap-0.5 px-2">
            <Loader2
              className="w-5 h-5 text-muted-foreground transition-opacity"
              style={{ opacity: Math.min(1, pullY / PULL_THRESHOLD) }}
              aria-hidden
            />
            {holdRevealMs && pullY >= PULL_THRESHOLD * 0.85 ? (
              <span className="text-[10px] text-muted-foreground text-center leading-tight max-w-[200px]">
                Удерживайте, чтобы открыть скрытые чаты
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        ref={effectiveScrollRef}
        className="relative z-30 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-transparent"
        style={{
          paddingTop: scrollPaddingTopPx,
          WebkitOverflowScrolling: "touch",
        }}
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
