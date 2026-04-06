import type { EmblaOptionsType } from "embla-carousel";

/**
 * Карта скролла для EDGE в ленте и на странице поста:
 *
 * - **Горизонтально** по области карусели — листание слайдов (Embla, ось `x`).
 * - **Вертикально** — обычный скролл родителя (лента, страница), как у любого поста.
 *
 * Реализация:
 * - На viewport Embla вешаем `touch-pan-y` (CSS): браузер отдаёт вертикаль жеста скроллу предка;
 *   горизонталь обрабатывает Embla (сравнивает |dx| и |dy| на `touchmove`, см. DragHandler в embla-carousel).
 * - Не вызывать `stopPropagation` на `touchstart`/`pointerdown` у всего блока EDGE — иначе ломается связь с вертикальным скроллом.
 */
export const EDGE_HORIZONTAL_CAROUSEL_OPTIONS: EmblaOptionsType = {
  axis: "x",
  loop: false,
  align: "start",
  /** Чуть выше дефолта Embla (10): вертикальный скролл ленты чаще «выигрывает» при косых жестах. */
  dragThreshold: 12,
};
