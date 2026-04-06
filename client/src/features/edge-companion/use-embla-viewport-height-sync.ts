import { useCallback, useEffect, useState } from "react";
import type { EmblaCarouselType } from "embla-carousel";

/**
 * Высота viewport Embla = высота активного слайда (лидерборд, задания и т.д.).
 * Для слайда «Персонаж» в ленте: опционально **строго квадрат** — высота = ширина viewport,
 * чтобы соседние длинные слайды не тянули блок по измерению высоты.
 */
export function useEmblaViewportHeightSync(
  emblaApi: EmblaCarouselType | undefined,
  emblaViewportRef: (node: HTMLDivElement | null) => void,
  /** Индекс слайда с квадратной карточкой персонажа (лентa). */
  squareSlideIndex?: number,
): (node: HTMLDivElement | null) => void {
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);

  const sync = useCallback(() => {
    if (!emblaApi || !viewportNode) return;
    const i = emblaApi.selectedScrollSnap();
    let h: number;
    if (typeof squareSlideIndex === "number" && squareSlideIndex === i) {
      h = Math.ceil(viewportNode.getBoundingClientRect().width);
    } else {
      const slides = emblaApi.slideNodes();
      const slide = slides[i];
      if (!slide) return;
      h = Math.ceil(slide.getBoundingClientRect().height);
    }
    if (h > 0) viewportNode.style.height = `${h}px`;
  }, [emblaApi, viewportNode, squareSlideIndex]);

  useEffect(() => {
    if (!emblaApi || !viewportNode) return;
    sync();
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    const ro = new ResizeObserver(() => sync());
    emblaApi.slideNodes().forEach((el) => ro.observe(el));
    ro.observe(viewportNode);

    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
      ro.disconnect();
      viewportNode.style.height = "";
    };
  }, [emblaApi, viewportNode, sync]);

  return useCallback(
    (node: HTMLDivElement | null) => {
      setViewportNode(node);
      emblaViewportRef(node);
    },
    [emblaViewportRef],
  );
}
