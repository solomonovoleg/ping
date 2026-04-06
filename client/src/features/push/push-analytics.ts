/**
 * Точки расширения под продуктовую аналитику Push. Сейчас: тихий лог в dev.
 */
export function trackPushUix(event: string, detail?: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  if (detail && Object.keys(detail).length > 0) {
    console.debug("[push-uix]", event, detail);
    return;
  }
  console.debug("[push-uix]", event);
}
