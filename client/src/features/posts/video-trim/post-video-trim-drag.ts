import type { RefObject, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";

type SetRangeFn = (s: number, e: number) => void;

/**
 * Перетаскивание маркеров/окна на таймлайне: window listeners + pointer capture.
 */
export function bindPostVideoTrimDrag(options: {
  kind: "L" | "R" | "M";
  pointerEvent: ReactPointerEvent<HTMLElement>;
  durationSec: number;
  s0: number;
  e0: number;
  trackRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  latestRangeRef: MutableRefObject<{ s: number; e: number }>;
  setRange: SetRangeFn;
}): void {
  const { kind, pointerEvent: e, durationSec: dur, s0, e0, trackRef, videoRef, latestRangeRef, setRange } = options;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  const px0 = e.clientX;
  const pointerId = e.pointerId;

  const timeFromClientX = (clientX: number): number => {
    const tr = trackRef.current;
    if (!tr || dur <= 0) return 0;
    const { left, width } = tr.getBoundingClientRect();
    return Math.min(dur, Math.max(0, ((clientX - left) / Math.max(width, 1)) * dur));
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const tw = trackRef.current?.getBoundingClientRect().width ?? 1;
    const dt = ((ev.clientX - px0) / tw) * dur;
    if (kind === "M") {
      const len = e0 - s0;
      let s = s0 + dt;
      let e2 = s + len;
      if (s < 0) {
        e2 -= s;
        s = 0;
      }
      if (e2 > dur) {
        const over = e2 - dur;
        s -= over;
        e2 = dur;
      }
      setRange(s, e2);
    } else if (kind === "L") {
      setRange(timeFromClientX(ev.clientX), e0);
    } else {
      setRange(s0, timeFromClientX(ev.clientX));
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v) v.currentTime = latestRangeRef.current.s;
    });
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
