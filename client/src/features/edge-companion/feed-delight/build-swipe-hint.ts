import { COMPANION_SURFACE_LABEL } from "@/features/edge-companion/companion-surfaces/surface-labels";
import type { CompanionSurfaceId } from "@/features/edge-companion/companion-surfaces/types";

/**
 * Подсказка для карусели EDGE: какие ещё экраны доступны свайпом (кроме текущего).
 * Используется в ленте (`EdgeFeedSurfacePager`) и в полном Companion (`CompanionSurfacePager`).
 * Не зависит от API — только порядок `visible` из конфига кампании.
 */
export function buildEdgeFeedSwipeHint(
  visible: CompanionSurfaceId[],
  selectedIndex: number,
): string | null {
  if (visible.length <= 1) return null;
  const names = visible
    .map((id, i) => (i === selectedIndex ? null : COMPANION_SURFACE_LABEL[id]))
    .filter((s): s is string => Boolean(s));
  if (names.length === 0) return null;
  return `Свайп — ещё: ${names.join(" · ")}`;
}
