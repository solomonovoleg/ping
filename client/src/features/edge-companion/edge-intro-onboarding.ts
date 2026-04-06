/**
 * Первое знакомство с EDGE: 3 шага (тапы → полный экран → свайп по разделам).
 * Флаги 2–3 — в localStorage; шаг 1 — серверный introTapCount.
 */

export const EDGE_INTRO_STEP1_TAPS = 25;

const storageKey = (edgeId: string) => `pingEdgeIntro:v1:${edgeId.trim()}`;

export type EdgeIntroFlags = {
  openedFull?: boolean;
  swipedSurface?: boolean;
};

export function readIntroFlags(edgeId: string): EdgeIntroFlags {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(edgeId));
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    return o as EdgeIntroFlags;
  } catch {
    return {};
  }
}

function writeIntroFlags(edgeId: string, patch: Partial<EdgeIntroFlags>): void {
  if (typeof window === "undefined") return;
  try {
    const prev = readIntroFlags(edgeId);
    localStorage.setItem(storageKey(edgeId), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* ignore quota */
  }
}

/** Вызывать с полного экрана /edge/… когда уже есть 25+ тапов. */
export function markIntroOpenedFullIfEligible(edgeId: string, introTapCount: number): void {
  if (introTapCount < EDGE_INTRO_STEP1_TAPS) return;
  writeIntroFlags(edgeId, { openedFull: true });
}

export function markIntroSwiped(edgeId: string): void {
  writeIntroFlags(edgeId, { swipedSurface: true });
}

export type EdgeIntroStep = 1 | 2 | 3 | "done";

export function resolveIntroStep(
  edgeId: string,
  introTapCount: number | undefined,
  options?: { hasMultipleSurfaces?: boolean },
): EdgeIntroStep {
  const taps = introTapCount ?? 0;
  const f = readIntroFlags(edgeId);
  const multi = options?.hasMultipleSurfaces !== false;
  if (taps < EDGE_INTRO_STEP1_TAPS) return 1;
  if (!f.openedFull) return 2;
  if (!multi) return "done";
  if (!f.swipedSurface) return 3;
  return "done";
}

/** После 25 тапов и полного экрана — фиксируем свайп на другой surface. */
export function tryRegisterIntroSurfaceSwipe(
  edgeId: string,
  introTapCount: number,
  visible: readonly string[],
  selectedIndex: number,
): void {
  if (introTapCount < EDGE_INTRO_STEP1_TAPS) return;
  const f = readIntroFlags(edgeId);
  if (!f.openedFull) return;
  const charIdx = visible.indexOf("character");
  if (charIdx < 0) return;
  if (selectedIndex === charIdx) return;
  markIntroSwiped(edgeId);
}
