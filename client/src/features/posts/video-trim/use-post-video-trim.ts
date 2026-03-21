import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import type { PostVideoTrimUpload } from "@/lib/posts";
import { bindPostVideoTrimDrag } from "./post-video-trim-drag";
import { normalizePostVideoTrimRange } from "./post-video-trim-range";

export function usePostVideoTrim(options: {
  open: boolean;
  file: File | null;
  onConfirm: (trim: PostVideoTrimUpload) => void;
}) {
  const { open, file, onConfirm } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [metaError, setMetaError] = useState<string | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(POST_VIDEO_MAX_SECONDS);
  const [playing, setPlaying] = useState(false);
  const latestRangeRef = useRef({ s: 0, e: POST_VIDEO_MAX_SECONDS });

  const durationSecRef = useRef(durationSec);
  durationSecRef.current = durationSec;
  const startSecRef = useRef(startSec);
  startSecRef.current = startSec;
  const endSecRef = useRef(endSec);
  endSecRef.current = endSec;

  useEffect(() => {
    if (!open || !file) {
      setMetaError(null);
      setDurationSec(0);
      setStartSec(0);
      setEndSec(POST_VIDEO_MAX_SECONDS);
      setPlaying(false);
      latestRangeRef.current = { s: 0, e: POST_VIDEO_MAX_SECONDS };
      setPreviewUrl(null);
      return;
    }
    setMetaError(null);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setPreviewUrl(null);
    };
  }, [open, file]);

  const onVideoLoaded = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) {
      setMetaError("Не удалось прочитать длительность видео");
      return;
    }
    setDurationSec(d);
    if (d <= POST_VIDEO_MAX_SECONDS + 0.05) {
      setStartSec(0);
      setEndSec(d);
      latestRangeRef.current = { s: 0, e: d };
    } else {
      setStartSec(0);
      setEndSec(POST_VIDEO_MAX_SECONDS);
      latestRangeRef.current = { s: 0, e: POST_VIDEO_MAX_SECONDS };
    }
    setMetaError(null);
  }, []);

  const onVideoError = useCallback(() => {
    setMetaError("Не удалось открыть видео");
  }, []);

  const setRange = useCallback((s: number, e: number) => {
    const [ns, ne] = normalizePostVideoTrimRange(s, e, durationSecRef.current);
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
      if (durationSecRef.current <= POST_VIDEO_MAX_SECONDS + 0.05 && kind !== "M") return;
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
      });
    },
    [metaError, setRange],
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
    void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [playing, metaError, startSec]);

  const handleConfirm = useCallback(() => {
    if (metaError || durationSec <= 0) return;
    const [s, e] = normalizePostVideoTrimRange(startSec, endSec, durationSec);
    onConfirm({
      trimStartSec: Math.round(s * 1000) / 1000,
      trimDurationSec: Math.round((e - s) * 1000) / 1000,
    });
  }, [metaError, durationSec, startSec, endSec, onConfirm]);

  const lockedShort = durationSec > 0 && durationSec <= POST_VIDEO_MAX_SECONDS + 0.05;
  const leftPct = durationSec > 0 ? (startSec / durationSec) * 100 : 0;
  const widthPct = durationSec > 0 ? ((endSec - startSec) / durationSec) * 100 : 100;

  return {
    videoRef,
    trackRef,
    previewUrl,
    metaError,
    durationSec,
    startSec,
    endSec,
    playing,
    lockedShort,
    leftPct,
    widthPct,
    onVideoLoaded,
    onVideoError,
    timeFromClientX,
    setRange,
    seekToStart,
    onPointerDownHandle,
    togglePlay,
    handleConfirm,
  };
}
