import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { POST_VIDEO_MAX_SECONDS, POST_VIDEO_MIN_SEGMENT_SECONDS } from "@shared/post-video";
import type { PostVideoTrimUpload } from "@/lib/posts";
import { bindPostVideoTrimDrag } from "./post-video-trim-drag";
import { normalizePostVideoTrimRange } from "./post-video-trim-range";

function buildVideoPosterFromStart(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    let done = false;

    const finish = (result: string | null) => {
      if (done) return;
      done = true;
      probe.pause();
      probe.removeAttribute("src");
      probe.load();
      resolve(result);
    };

    const drawFrame = () => {
      const width = probe.videoWidth;
      const height = probe.videoHeight;
      if (width <= 0 || height <= 0) {
        finish(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        finish(null);
        return;
      }
      try {
        ctx.drawImage(probe, 0, 0, width, height);
      } catch {
        finish(null);
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            finish(null);
            return;
          }
          finish(URL.createObjectURL(blob));
        },
        "image/jpeg",
        0.9,
      );
    };

    probe.preload = "auto";
    probe.muted = true;
    probe.playsInline = true;
    probe.onloadeddata = () => {
      const d = Number.isFinite(probe.duration) ? probe.duration : 0;
      const safeEnd = Math.max(0, d - 0.05);
      try {
        probe.currentTime = Math.min(0.001, safeEnd || 0.001);
      } catch {
        drawFrame();
      }
    };
    probe.onseeked = drawFrame;
    probe.onerror = () => finish(null);
    probe.src = videoUrl;
  });
}

export function usePostVideoTrim(options: {
  open: boolean;
  file: File | null;
  /** Лимит выбранного фрагмента, сек. (пост 14, аватар 4). */
  maxSegmentSeconds?: number;
  onConfirm: (trim: PostVideoTrimUpload) => void;
}) {
  const { open, file, onConfirm } = options;
  const cap = options.maxSegmentSeconds ?? POST_VIDEO_MAX_SECONDS;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const posterUrlRef = useRef<string | null>(null);
  const posterTaskRef = useRef(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(cap);
  const [playing, setPlaying] = useState(false);
  const latestRangeRef = useRef({ s: 0, e: cap });
  const capRef = useRef(cap);
  capRef.current = cap;

  const durationSecRef = useRef(durationSec);
  durationSecRef.current = durationSec;
  const startSecRef = useRef(startSec);
  startSecRef.current = startSec;
  const endSecRef = useRef(endSec);
  endSecRef.current = endSec;

  const playingRef = useRef(playing);
  playingRef.current = playing;

  /** iOS/WebKit: один раз после появления данных заставляем декодер отрисовать кадр (seek на metadata часто оставляет чёрный прямоугольник). */
  const decodedPaintOnceRef = useRef(false);
  const dragPreviewTimerRef = useRef<number | null>(null);

  const clearDragPreviewTimer = useCallback(() => {
    if (dragPreviewTimerRef.current !== null) {
      window.clearTimeout(dragPreviewTimerRef.current);
      dragPreviewTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open || !file) {
      clearDragPreviewTimer();
      posterTaskRef.current += 1;
      setMetaError(null);
      setDurationSec(0);
      setStartSec(0);
      setEndSec(capRef.current);
      setPlaying(false);
      latestRangeRef.current = { s: 0, e: capRef.current };
      setPreviewUrl(null);
      if (posterUrlRef.current) {
        URL.revokeObjectURL(posterUrlRef.current);
        posterUrlRef.current = null;
      }
      setPosterUrl(null);
      decodedPaintOnceRef.current = false;
      return;
    }
    setMetaError(null);
    decodedPaintOnceRef.current = false;
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    const posterTask = ++posterTaskRef.current;
    void buildVideoPosterFromStart(url)
      .then((nextPosterUrl) => {
        if (posterTaskRef.current !== posterTask) {
          if (nextPosterUrl) URL.revokeObjectURL(nextPosterUrl);
          return;
        }
        if (posterUrlRef.current) {
          URL.revokeObjectURL(posterUrlRef.current);
        }
        posterUrlRef.current = nextPosterUrl;
        setPosterUrl(nextPosterUrl);
      })
      .catch(() => {
        if (posterTaskRef.current !== posterTask) return;
        if (posterUrlRef.current) {
          URL.revokeObjectURL(posterUrlRef.current);
          posterUrlRef.current = null;
        }
        setPosterUrl(null);
      });
    return () => {
      clearDragPreviewTimer();
      posterTaskRef.current += 1;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (posterUrlRef.current) {
        URL.revokeObjectURL(posterUrlRef.current);
        posterUrlRef.current = null;
      }
      setPreviewUrl(null);
      setPosterUrl(null);
    };
  }, [open, file, clearDragPreviewTimer]);

  useEffect(() => {
    if (!open || !file) return;
    setEndSec((e) => Math.min(e, cap));
    latestRangeRef.current = {
      s: latestRangeRef.current.s,
      e: Math.min(latestRangeRef.current.e, cap),
    };
  }, [open, file, cap]);

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    const maxSeg = capRef.current;
    if (!Number.isFinite(d) || d <= 0) {
      setMetaError("Не удалось прочитать длительность видео");
      return;
    }
    setDurationSec(d);
    if (d <= maxSeg + 0.05) {
      setStartSec(0);
      setEndSec(d);
      latestRangeRef.current = { s: 0, e: d };
    } else {
      setStartSec(0);
      setEndSec(maxSeg);
      latestRangeRef.current = { s: 0, e: maxSeg };
    }
    setMetaError(null);
    // iOS/WebKit: без muted + seek первый кадр часто не рисуется до play().
    const s = latestRangeRef.current.s;
    const safeEnd = Math.max(0, d - 0.05);
    const target = s <= 0 ? Math.min(0.001, safeEnd || 0.001) : Math.min(Math.max(s, 0), safeEnd);
    try {
      v.currentTime = target;
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      const el = videoRef.current;
      if (!el || el !== v) return;
      try {
        const s2 = latestRangeRef.current.s;
        const d2 = el.duration;
        if (!Number.isFinite(d2) || d2 <= 0) return;
        const end2 = Math.max(0, d2 - 0.05);
        el.currentTime = s2 <= 0 ? Math.min(0.001, end2 || 0.001) : Math.min(Math.max(s2, 0), end2);
      } catch {
        /* ignore */
      }
    });
  }, []);

  const seekToRangeForPaint = useCallback((v: HTMLVideoElement) => {
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const s = latestRangeRef.current.s;
    const safeEnd = Math.max(0, d - 0.05);
    const target = s <= 0 ? Math.min(0.001, safeEnd || 0.001) : Math.min(Math.max(s, 0), safeEnd);
    try {
      v.currentTime = target;
    } catch {
      /* ignore */
    }
  }, []);

  const bumpDecodedFramePaint = useCallback((v: HTMLVideoElement) => {
    if (v.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    v.muted = true;
    void v
      .play()
      .then(() => {
        v.pause();
        try {
          v.currentTime = latestRangeRef.current.s;
        } catch {
          /* ignore */
        }
        v.muted = !playingRef.current;
      })
      .catch(() => {
        v.muted = !playingRef.current;
      });
  }, []);

  const onVideoLoadedData = useCallback(() => {
    const v = videoRef.current;
    if (!v || decodedPaintOnceRef.current) return;
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    seekToRangeForPaint(v);
    requestAnimationFrame(() => {
      const el = videoRef.current;
      if (!el || decodedPaintOnceRef.current) return;
      seekToRangeForPaint(el);
      requestAnimationFrame(() => {
        const el2 = videoRef.current;
        if (!el2 || decodedPaintOnceRef.current) return;
        decodedPaintOnceRef.current = true;
        bumpDecodedFramePaint(el2);
      });
    });
  }, [seekToRangeForPaint, bumpDecodedFramePaint]);

  const onVideoError = useCallback(() => {
    setMetaError("Не удалось открыть видео");
  }, []);

  const previewCurrentRange = useCallback(() => {
    const v = videoRef.current;
    if (!v || metaError || durationSecRef.current <= 0) return;
    const s = latestRangeRef.current.s;
    try {
      v.currentTime = s;
    } catch {
      /* ignore */
    }
    v.muted = false;
    setPlaying(true);
    void v.play().catch(() => {
      setPlaying(false);
    });
  }, [metaError]);

  const previewSelection = useCallback(
    (reason: "drag" | "commit") => {
      if (reason === "drag") {
        clearDragPreviewTimer();
        dragPreviewTimerRef.current = window.setTimeout(() => {
          dragPreviewTimerRef.current = null;
          previewCurrentRange();
        }, 120);
        return;
      }
      clearDragPreviewTimer();
      previewCurrentRange();
    },
    [clearDragPreviewTimer, previewCurrentRange],
  );

  const setRange = useCallback((s: number, e: number) => {
    const [ns, ne] = normalizePostVideoTrimRange(s, e, durationSecRef.current, capRef.current);
    latestRangeRef.current = { s: ns, e: ne };
    setStartSec(ns);
    setEndSec(ne);
  }, []);

  const seekToStart = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startSec;
  }, [startSec]);

  useEffect(() => {
    if (!open) return;
    seekToStart();
  }, [open, startSec, seekToStart]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    const onTime = () => {
      if (v.currentTime >= endSec - 0.04) {
        v.pause();
        setPlaying(false);
        v.currentTime = startSec;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [playing, endSec, startSec]);

  const timeFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    const dur = durationSecRef.current;
    if (!el || dur <= 0) return 0;
    const { left, width } = el.getBoundingClientRect();
    const r = (clientX - left) / Math.max(width, 1);
    return Math.min(dur, Math.max(0, r * dur));
  }, []);

  const onPointerDownHandle = useCallback(
    (kind: "L" | "R" | "M", e: ReactPointerEvent<HTMLElement>) => {
      if (metaError || durationSecRef.current <= 0) return;
      e.preventDefault();
      e.stopPropagation();
      bindPostVideoTrimDrag({
        kind,
        pointerEvent: e,
        durationSec: durationSecRef.current,
        s0: startSecRef.current,
        e0: endSecRef.current,
        trackRef,
        videoRef,
        latestRangeRef,
        setRange,
        previewSelection,
      });
    },
    [metaError, setRange, previewSelection],
  );

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || metaError) return;
    if (playing) {
      v.pause();
      setPlaying(false);
      return;
    }
    v.currentTime = startSec;
    v.muted = false;
    setPlaying(true);
    void v.play().catch(() => setPlaying(false));
  }, [playing, metaError, startSec]);

  const handleConfirm = useCallback(() => {
    if (metaError || durationSec <= 0) return;
    const [s, e] = normalizePostVideoTrimRange(startSec, endSec, durationSec, cap);
    onConfirm({
      trimStartSec: Math.round(s * 1000) / 1000,
      trimDurationSec: Math.round((e - s) * 1000) / 1000,
    });
  }, [metaError, durationSec, startSec, endSec, onConfirm, cap]);

  /** Без ручек только если ролик короче минимально допустимого фрагмента — иначе всегда можно сдвинуть начало/конец. */
  const lockedShort = durationSec > 0 && durationSec <= POST_VIDEO_MIN_SEGMENT_SECONDS + 0.02;
  const leftPct = durationSec > 0 ? (startSec / durationSec) * 100 : 0;
  const widthPct = durationSec > 0 ? ((endSec - startSec) / durationSec) * 100 : 100;

  return {
    videoRef,
    trackRef,
    previewUrl,
    posterUrl,
    metaError,
    durationSec,
    startSec,
    endSec,
    playing,
    lockedShort,
    leftPct,
    widthPct,
    onVideoLoaded,
    onVideoLoadedData,
    onVideoError,
    timeFromClientX,
    setRange,
    seekToStart,
    previewCurrentRange,
    onPointerDownHandle,
    togglePlay,
    handleConfirm,
    maxSegmentSeconds: cap,
  };
}
