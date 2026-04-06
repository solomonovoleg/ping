import { useEffect, useState, type RefObject } from "react";

export function usePulseProfileLayoutScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  renderCover: boolean,
  onScrollYChange?: (scrollTop: number) => void,
): number {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const fn = () => {
      const y = el.scrollTop;
      if (renderCover) setScrollY(y);
      onScrollYChange?.(y);
    };
    el.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => el.removeEventListener("scroll", fn);
  }, [scrollRef, renderCover, onScrollYChange]);

  return scrollY;
}
