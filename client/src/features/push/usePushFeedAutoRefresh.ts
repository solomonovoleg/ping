import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 45_000;

/**
 * Мягкое обновление Push-ленты, пока открыт раздел и вкладка в фокусе (без WebSocket).
 */
export function usePushFeedAutoRefresh(enabled: boolean, refetch: () => void, intervalMs = DEFAULT_INTERVAL_MS): void {
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      refetchRef.current();
    };
    const id = window.setInterval(tick, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [enabled, intervalMs]);
}
