function isCapacitorIOS(): boolean {
  try {
    const c = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } })
      .Capacitor;
    return Boolean(c?.isNativePlatform?.() && c?.getPlatform?.() === "ios");
  } catch {
    return false;
  }
}

/**
 * Параметры краевого свайпа (лента ↔ чаты ↔ рилсы, назад из чата).
 * Ближе к нативным приложениям: меньший «дотащить», флик по скорости, мягче отмена при скролле.
 */
export const EDGE_SWIPE = {
  leftZonePx: 44,
  rightZonePx: 44,
  topExcludePx: 64,
  /** Дистанция: доля ширины экрана, зажатая в [min, max] px — короткий свайп тоже переключает */
  commitDistMinPx: 12,
  commitDistMaxPx: 28,
  commitWidthFraction: 0.05,
  /** Флик по последнему сегменту движения */
  velocityCommitPxPerMs: 0.1,
  velocityMinDxPx: 8,
  /** Если мало move-событий: средняя скорость за весь жест (медленный короткий свайп) */
  avgVelocityMinDxPx: 12,
  avgVelocityCommitPxPerMs: 0.045,
  avgGestureMaxMs: 520,
  /** Вертикальная отмена только при явном скролле */
  verticalCancelMinDyPx: 40,
  verticalCancelRatio: 1.5,
} as const;

/** Левый/правый край для «системных» жестов (не чат): на iOS шире — проще попасть пальцем. */
export function edgeNavLeftZonePx(): number {
  return isCapacitorIOS() ? 64 : EDGE_SWIPE.leftZonePx;
}

export function edgeNavRightZonePx(): number {
  return isCapacitorIOS() ? 64 : EDGE_SWIPE.rightZonePx;
}

/**
 * Назад из открытого диалога: старт с любой точки поверхности (кроме исключений), короткий L→R.
 * Мягче отмена по вертикали, чем у EDGE_SWIPE — на iOS меньше ложных срывов при скролле ленты.
 */
export const CHAT_BACK_SWIPE = {
  commitDistMinPx: 10,
  commitDistMaxPx: 26,
  commitWidthFraction: 0.048,
  velocityCommitPxPerMs: 0.085,
  velocityMinDxPx: 6,
  avgVelocityMinDxPx: 10,
  avgVelocityCommitPxPerMs: 0.038,
  avgGestureMaxMs: 560,
  verticalCancelMinDyPx: 46,
  verticalCancelRatio: 2.05,
} as const;

export function chatBackSwipeCommitDistancePx(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth || 390 : 390;
  return Math.max(
    CHAT_BACK_SWIPE.commitDistMinPx,
    Math.min(CHAT_BACK_SWIPE.commitDistMaxPx, vw * CHAT_BACK_SWIPE.commitWidthFraction),
  );
}

export function chatBackSwipeShouldCancelAsVerticalScroll(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
): boolean {
  const adx = Math.abs(clientX - startX);
  const ady = Math.abs(clientY - startY);
  if (ady < CHAT_BACK_SWIPE.verticalCancelMinDyPx) return false;
  return ady > adx * CHAT_BACK_SWIPE.verticalCancelRatio;
}

export function chatBackSwipeShouldCommitSwipeRight(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const dx = endX - startX;
  const threshold = chatBackSwipeCommitDistancePx();
  if (dx >= threshold) return true;
  const dtSeg = Math.max(12, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (dx >= CHAT_BACK_SWIPE.velocityMinDxPx && vxSeg >= CHAT_BACK_SWIPE.velocityCommitPxPerMs) return true;
  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > CHAT_BACK_SWIPE.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(40, dtTotal);
  return dx >= CHAT_BACK_SWIPE.avgVelocityMinDxPx && vxAvg >= CHAT_BACK_SWIPE.avgVelocityCommitPxPerMs;
}

/** Отмена вертикальным скроллом для краевой навигации (чаты→профиль, лента и т.д.): на iOS чуть терпимее к диагонали. */
export function edgeNavSwipeShouldCancelAsVerticalScroll(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
): boolean {
  const adx = Math.abs(clientX - startX);
  const ady = Math.abs(clientY - startY);
  const minDy = isCapacitorIOS() ? 48 : EDGE_SWIPE.verticalCancelMinDyPx;
  const ratio = isCapacitorIOS() ? 1.82 : EDGE_SWIPE.verticalCancelRatio;
  if (ady < minDy) return false;
  return ady > adx * ratio;
}

export function edgeSwipeCommitDistancePx(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth || 390 : 390;
  return Math.max(
    EDGE_SWIPE.commitDistMinPx,
    Math.min(EDGE_SWIPE.commitDistMaxPx, vw * EDGE_SWIPE.commitWidthFraction),
  );
}

/**
 * Зона старта жеста «переключить вкладку» (Чаты / Лента / Борд) в AppLayout.
 * Шире, чем `EDGE_SWIPE.*ZonePx` для «назад», чтобы не нужно было целиться в узкий край.
 */
export function mainTabPagerEdgeZonePx(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth || 390 : 390;
  if (isCapacitorIOS()) {
    return Math.round(Math.min(104, Math.max(56, vw * 0.22)));
  }
  return Math.round(Math.min(80, Math.max(48, vw * 0.16)));
}

/**
 * Переключение Чаты ↔ Лента ↔ Борд (AppLayout): одна вкладка за жест, заметное протягивание,
 * без «улёта» от лёгкого флика. Отдельно от EDGE_SWIPE (чат «назад», лента→рилсы).
 */
export const MAIN_TAB_PAGER_SWIPE = {
  commitDistMinPx: 36,
  commitDistMaxPx: 72,
  commitWidthFraction: 0.12,
  velocityCommitPxPerMs: 0.24,
  velocityMinDxPx: 22,
  avgVelocityMinDxPx: 30,
  avgVelocityCommitPxPerMs: 0.07,
  avgGestureMaxMs: 360,
  /** После успешного переключения вкладки — игнор повторных коммитов (двойные слушатели / отскок). */
  postNavigateCooldownMs: 480,
} as const;

export function mainTabPagerCommitDistancePx(): number {
  const vw = typeof window !== "undefined" ? window.innerWidth || 390 : 390;
  return Math.max(
    MAIN_TAB_PAGER_SWIPE.commitDistMinPx,
    Math.min(MAIN_TAB_PAGER_SWIPE.commitDistMaxPx, vw * MAIN_TAB_PAGER_SWIPE.commitWidthFraction),
  );
}

export function mainTabPagerShouldCommitSwipeRight(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const ios = isCapacitorIOS();
  const vMin = ios ? 18 : MAIN_TAB_PAGER_SWIPE.velocityMinDxPx;
  const vCommit = ios ? 0.2 : MAIN_TAB_PAGER_SWIPE.velocityCommitPxPerMs;
  const avgMin = ios ? 24 : MAIN_TAB_PAGER_SWIPE.avgVelocityMinDxPx;
  const avgCommit = ios ? 0.058 : MAIN_TAB_PAGER_SWIPE.avgVelocityCommitPxPerMs;
  const dx = endX - startX;
  const threshold = mainTabPagerCommitDistancePx();
  if (dx >= threshold) return true;
  const dtSeg = Math.max(16, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (dx >= vMin && vxSeg >= vCommit) return true;
  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > MAIN_TAB_PAGER_SWIPE.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(48, dtTotal);
  return dx >= avgMin && vxAvg >= avgCommit;
}

export function mainTabPagerShouldCommitSwipeLeft(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const ios = isCapacitorIOS();
  const vMin = ios ? 18 : MAIN_TAB_PAGER_SWIPE.velocityMinDxPx;
  const vCommit = ios ? 0.2 : MAIN_TAB_PAGER_SWIPE.velocityCommitPxPerMs;
  const avgMin = ios ? 24 : MAIN_TAB_PAGER_SWIPE.avgVelocityMinDxPx;
  const avgCommit = ios ? 0.058 : MAIN_TAB_PAGER_SWIPE.avgVelocityCommitPxPerMs;
  const dx = endX - startX;
  const threshold = mainTabPagerCommitDistancePx();
  if (dx <= -threshold) return true;
  const dtSeg = Math.max(16, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (dx <= -vMin && vxSeg <= -vCommit) return true;
  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > MAIN_TAB_PAGER_SWIPE.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(48, dtTotal);
  return dx <= -avgMin && vxAvg <= -avgCommit;
}

/** true = жест похож на скролл вверх/вниз, краевую навигацию отменяем */
export function edgeSwipeShouldCancelAsVerticalScroll(
  startX: number,
  startY: number,
  clientX: number,
  clientY: number,
): boolean {
  const adx = Math.abs(clientX - startX);
  const ady = Math.abs(clientY - startY);
  if (ady < EDGE_SWIPE.verticalCancelMinDyPx) return false;
  return ady > adx * EDGE_SWIPE.verticalCancelRatio;
}

/** Свайп слева → вправо (dx > 0). `startTime` — performance.now() у pointerdown. */
export function edgeSwipeShouldCommitSwipeRight(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const dx = endX - startX;
  const threshold = edgeSwipeCommitDistancePx();
  if (dx >= threshold) return true;
  const dtSeg = Math.max(12, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (dx >= EDGE_SWIPE.velocityMinDxPx && vxSeg >= EDGE_SWIPE.velocityCommitPxPerMs) return true;
  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > EDGE_SWIPE.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(40, dtTotal);
  return dx >= EDGE_SWIPE.avgVelocityMinDxPx && vxAvg >= EDGE_SWIPE.avgVelocityCommitPxPerMs;
}

/** Свайп справа → влево (dx < 0) */
export function edgeSwipeShouldCommitSwipeLeft(
  startX: number,
  endX: number,
  lastX: number,
  lastT: number,
  endTime: number,
  startTime: number,
): boolean {
  const dx = endX - startX;
  const threshold = edgeSwipeCommitDistancePx();
  if (dx <= -threshold) return true;
  const dtSeg = Math.max(12, endTime - lastT);
  const vxSeg = (endX - lastX) / dtSeg;
  if (dx <= -EDGE_SWIPE.velocityMinDxPx && vxSeg <= -EDGE_SWIPE.velocityCommitPxPerMs) return true;
  const dtTotal = endTime - startTime;
  if (dtTotal <= 0 || dtTotal > EDGE_SWIPE.avgGestureMaxMs) return false;
  const vxAvg = dx / Math.max(40, dtTotal);
  return dx <= -EDGE_SWIPE.avgVelocityMinDxPx && vxAvg <= -EDGE_SWIPE.avgVelocityCommitPxPerMs;
}
