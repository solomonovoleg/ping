import { useEffect, type RefObject } from "react";

const NEAR_END_SEC = 0.08;

/**
 * Псевдо-бесшовный цикл: за ~80 мс до конца переносим currentTime в 0 без паузы.
 * Нативный `loop` на части клипов даёт заметный разрыв; этот вариант обычно мягче.
 */
export function useSeamlessVideoLoop(
  videoRef: RefObject<HTMLVideoElement | null>,
  opts: { enabled: boolean; srcKey: string },
) {
  const { enabled, srcKey } = opts;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !enabled) return;

    const onTime = () => {
      const d = v.duration;
      if (!Number.isFinite(d) || d <= NEAR_END_SEC * 2) return;
      if (v.currentTime >= d - NEAR_END_SEC) {
        try {
          v.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    };

    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [enabled, srcKey, videoRef]);
}
