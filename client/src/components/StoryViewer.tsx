import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MoreHorizontal,
  Heart,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  Share2,
  Archive,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { fetchStoryViewers, type StoryViewerUser } from "@/lib/stories";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  DURATION_NORMAL_S,
  DURATION_FAST_S,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

interface Story {
  id: string | number;
  image: string;
  userName: string;
  userAvatar: string;
  time: string;
  authorId?: string;
  expiresAt?: string;
  likesCount?: number;
  isLiked?: boolean;
}

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  viewerUserId?: string;
  onStoryView?: (storyId: string) => void;
  onOpenViewers?: (storyId: string) => void;
  canSeeViewers?: boolean;
  viewersCountByStoryId?: Record<string, number>;
  onReply?: (payload: {
    storyId: string;
    authorId: string;
    text: string;
    story: { id: string; image: string; userName: string; userAvatar: string; time: string };
  }) => Promise<void> | void;
  canReply?: boolean;
  onToggleLike?: (storyId: string, liked: boolean) => Promise<void> | void;
  canLike?: boolean;
  likedByStoryId?: Record<string, boolean>;
  likesCountByStoryId?: Record<string, number>;
  canManage?: boolean;
  onShareStory?: (story: { id: string; image: string; userName: string; time: string }) => Promise<void> | void;
  onArchiveStory?: (storyId: string) => Promise<void> | void;
  onDeleteStory?: (storyId: string) => Promise<void> | void;
}

const SWIPE_PX = 56;
const DOUBLE_TAP_MS = 280;
const TAP_MOVE_MAX_PX = 14;
const STORY_SOUND_PREF_KEY = "story-video-muted";

function getInitialStorySoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORY_SOUND_PREF_KEY) === "1";
}

export default function StoryViewer({
  stories,
  initialIndex = 0,
  onClose,
  viewerUserId,
  onStoryView,
  onOpenViewers,
  canSeeViewers: _canSeeViewers = false,
  viewersCountByStoryId = {},
  onReply,
  canReply = true,
  onToggleLike,
  canLike = true,
  likedByStoryId = {},
  likesCountByStoryId = {},
  canManage: _canManage = false,
  onShareStory,
  onArchiveStory,
  onDeleteStory,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [actionsBusy, setActionsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewerPreview, setViewerPreview] = useState<StoryViewerUser[]>([]);
  const [viewerPreviewLoading, setViewerPreviewLoading] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [storyVideoMuted, setStoryVideoMuted] = useState(getInitialStorySoundMuted);
  const [soundHudVisible, setSoundHudVisible] = useState(false);
  const [soundHudIsMuted, setSoundHudIsMuted] = useState(true);
  const [likeBurst, setLikeBurst] = useState<Array<{ id: number; x: number; y: number; drift: number; delay: number }>>([]);

  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeCommittedRef = useRef(false);
  const tapMetaRef = useRef<{ at: number; x: number; y: number; timerId: number | null } | null>(null);
  const soundHudTimerRef = useRef<number | null>(null);
  const likeBurstSeqRef = useRef(1);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      if (soundHudTimerRef.current) window.clearTimeout(soundHudTimerRef.current);
      const tap = tapMetaRef.current;
      if (tap?.timerId) window.clearTimeout(tap.timerId);
    };
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex]);

  useEffect(() => {
    if (stories.length === 0) return;
    setCurrentIndex((c) => Math.min(c, stories.length - 1));
  }, [stories.length]);

  useEffect(() => {
    const s = stories[currentIndex];
    if (s && onStoryView && typeof s.id === "string" && s.id.length > 20) {
      onStoryView(s.id);
    }
  }, [currentIndex, stories, onStoryView]);

  useEffect(() => {
    setShowActions(false);
    setActionError(null);
    setConfirmDelete(false);
  }, [currentIndex]);

  useEffect(() => {
    if (prefersReducedMotion || stories.length < 2) {
      setShowSwipeHint(false);
      return;
    }
    setShowSwipeHint(true);
    const t = window.setTimeout(() => setShowSwipeHint(false), 3200);
    return () => window.clearTimeout(t);
  }, [currentIndex, stories.length, prefersReducedMotion]);

  const currentStory = stories[currentIndex];
  const currentStoryId = typeof currentStory?.id === "string" ? currentStory.id : null;
  const currentStoryAuthorId = currentStory?.authorId ?? "";
  const isOwnCurrentStory =
    !!viewerUserId && !!currentStoryAuthorId && currentStoryAuthorId === viewerUserId;

  useEffect(() => {
    if (!isOwnCurrentStory || !currentStoryId) {
      setViewerPreview([]);
      return;
    }
    let cancelled = false;
    setViewerPreviewLoading(true);
    void fetchStoryViewers(currentStoryId)
      .then((list) => {
        if (!cancelled) setViewerPreview(Array.isArray(list) ? list.slice(0, 3) : []);
      })
      .catch(() => {
        if (!cancelled) setViewerPreview([]);
      })
      .finally(() => {
        if (!cancelled) setViewerPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwnCurrentStory, currentStoryId]);

  const currentMediaUrl = currentStory?.image ?? "";
  const isVideoStory = isLikelyStoryVideoUrl(currentMediaUrl);

  const showSoundHud = useCallback((muted: boolean) => {
    setSoundHudIsMuted(muted);
    setSoundHudVisible(true);
    if (soundHudTimerRef.current) window.clearTimeout(soundHudTimerRef.current);
    soundHudTimerRef.current = window.setTimeout(() => setSoundHudVisible(false), 760);
  }, []);

  const toggleStorySound = useCallback(
    (nextMuted?: boolean) => {
      const v = storyVideoRef.current;
      const muted = typeof nextMuted === "boolean" ? nextMuted : !storyVideoMuted;
      setStoryVideoMuted(muted);
      showSoundHud(muted);
      if (!v) return;
      v.muted = muted;
      void v.play().catch(() => {
        v.muted = true;
        setStoryVideoMuted(true);
        showSoundHud(true);
      });
    },
    [showSoundHud, storyVideoMuted]
  );

  const triggerLikeBurst = useCallback((x: number, y: number) => {
    if (prefersReducedMotion) return;
    const baseId = likeBurstSeqRef.current++;
    const next = Array.from({ length: 8 }).map((_, idx) => ({
      id: baseId * 100 + idx,
      x,
      y,
      drift: -24 + Math.random() * 48,
      delay: idx * 0.03,
    }));
    setLikeBurst((prev) => [...prev, ...next]);
    window.setTimeout(() => {
      setLikeBurst((prev) => prev.filter((i) => i.id < baseId * 100 || i.id >= baseId * 100 + 8));
    }, 1600);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORY_SOUND_PREF_KEY, storyVideoMuted ? "1" : "0");
  }, [storyVideoMuted]);

  useEffect(() => {
    setProgress(0);
    const tap = tapMetaRef.current;
    if (tap?.timerId) window.clearTimeout(tap.timerId);
    tapMetaRef.current = null;
  }, [currentIndex]);

  useEffect(() => {
    if (isPaused) return;
    if (isVideoStory) return;

    const duration = 15000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((c) => c + 1);
            return 0;
          }
          clearInterval(timer);
          onClose?.();
          return 100;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, stories.length, onClose, isPaused, isVideoStory]);

  useEffect(() => {
    if (!currentStory || !isLikelyStoryVideoUrl(currentStory.image)) return;
    const preferredMuted = getInitialStorySoundMuted();
    setStoryVideoMuted(preferredMuted);
    setSoundHudVisible(false);
    const tap = tapMetaRef.current;
    if (tap?.timerId) window.clearTimeout(tap.timerId);
    tapMetaRef.current = null;
    const id = window.requestAnimationFrame(() => {
      const v = storyVideoRef.current;
      if (!v) return;
      v.muted = preferredMuted;
      const p = v.play();
      if (p && !preferredMuted) {
        p.catch(() => {
          v.muted = true;
          setStoryVideoMuted(true);
          void v.play().catch(() => {});
        });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [currentStory?.id, currentStory?.image]);

  useEffect(() => {
    if (!currentStory || !isLikelyStoryVideoUrl(currentStory.image)) return;
    const v = storyVideoRef.current;
    if (!v) return;
    if (isPaused) v.pause();
    else {
      void v.play().catch(() => {
        v.muted = true;
        setStoryVideoMuted(true);
      });
    }
  }, [isPaused, currentStory?.id, currentStory?.image]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((c) => c + 1);
      setProgress(0);
    } else {
      onClose?.();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((c) => c - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }, [currentIndex]);

  const onStoryVideoTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
    setProgress(Math.min(100, (v.currentTime / v.duration) * 100));
  }, []);

  const onStoryVideoEnded = useCallback(() => {
    goNext();
  }, [goNext]);

  if (!stories.length) return null;

  const canReplyCurrentStory =
    !!onReply &&
    !!currentStoryId &&
    !!currentStoryAuthorId &&
    !isOwnCurrentStory &&
    (viewerUserId ? true : canReply);
  const canLikeCurrentStory =
    !!onToggleLike &&
    !!currentStoryId &&
    !!currentStoryAuthorId &&
    !isOwnCurrentStory &&
    (viewerUserId ? true : canLike);
  const viewersCount = currentStoryId ? viewersCountByStoryId[currentStoryId] ?? 0 : 0;
  const isLiked = currentStoryId
    ? likedByStoryId[currentStoryId] ?? currentStory?.isLiked ?? false
    : false;
  const likesCount = currentStoryId
    ? likesCountByStoryId[currentStoryId] ?? currentStory?.likesCount ?? 0
    : 0;
  const expiresAt = currentStory?.expiresAt ? new Date(currentStory.expiresAt) : null;
  const remainingLabel = formatStoryRemainingShort(expiresAt);

  const handleReplySend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = replyText.trim();
    const storyId = typeof currentStory?.id === "string" ? currentStory.id : "";
    const authorId = currentStory?.authorId ?? "";
    if (!text || !storyId || !authorId || !onReply || sendingReply) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      await onReply({
        storyId,
        authorId,
        text,
        story: {
          id: storyId,
          image: currentStory?.image ?? "",
          userName: currentStory?.userName ?? "",
          userAvatar: currentStory?.userAvatar ?? "",
          time: currentStory?.time ?? "",
        },
      });
      setReplyText("");
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Не удалось отправить ответ");
    } finally {
      setSendingReply(false);
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const text = replyText.trim();
    const storyId = typeof currentStory?.id === "string" ? currentStory.id : "";
    const authorId = currentStory?.authorId ?? "";
    if (!text || !storyId || !authorId || !onReply || sendingReply) return;
    setSendingReply(true);
    setReplyError(null);
    Promise.resolve(
      onReply({
        storyId,
        authorId,
        text,
        story: {
          id: storyId,
          image: currentStory?.image ?? "",
          userName: currentStory?.userName ?? "",
          userAvatar: currentStory?.userAvatar ?? "",
          time: currentStory?.time ?? "",
        },
      })
    )
      .then(() => setReplyText(""))
      .catch((err: unknown) => setReplyError(err instanceof Error ? err.message : "Не удалось отправить ответ"))
      .finally(() => setSendingReply(false));
  };

  const onMainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipeCommittedRef.current = false;
    setDragX(0);
    /** Удержание = пауза (как в Telegram); отпускание — снова воспроизведение */
    setIsPaused(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onMainPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = pointerStartRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    /* движение — не отменяем паузу до отпускания; свайп обрабатывается ниже */
    if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 0.65) {
      swipeCommittedRef.current = true;
      setDragX(Math.max(-72, Math.min(72, dx * 0.35)));
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>, clientX: number) => {
    const s = pointerStartRef.current;
    pointerStartRef.current = null;
    setDragX(0);
    setIsPaused(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    if (s && swipeCommittedRef.current) {
      const dx = clientX - s.x;
      if (dx < -SWIPE_PX) {
        goNext();
        swipeCommittedRef.current = false;
        return;
      }
      if (dx > SWIPE_PX) {
        goPrev();
        swipeCommittedRef.current = false;
        return;
      }
      swipeCommittedRef.current = false;
      return;
    }

    if (s) {
      const movedEnough = Math.hypot(clientX - s.x, e.clientY - s.y) > TAP_MOVE_MAX_PX;
      if (!movedEnough) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = clientX - rect.left;
        const now = Date.now();
        const prevTap = tapMetaRef.current;
        const isDoubleTap =
          !!prevTap &&
          now - prevTap.at <= DOUBLE_TAP_MS &&
          Math.hypot(clientX - prevTap.x, e.clientY - prevTap.y) < 56;

        if (isDoubleTap) {
          if (prevTap.timerId) window.clearTimeout(prevTap.timerId);
          tapMetaRef.current = null;
          toggleStorySound();
          return;
        }

        const leftZone = x < rect.width / 3;
        const rightZone = x > (rect.width * 2) / 3;

        if (leftZone) {
          if (prevTap?.timerId) window.clearTimeout(prevTap.timerId);
          tapMetaRef.current = null;
          goPrev();
          return;
        }
        if (rightZone) {
          if (prevTap?.timerId) window.clearTimeout(prevTap.timerId);
          tapMetaRef.current = null;
          goNext();
          return;
        }

        if (prevTap?.timerId) window.clearTimeout(prevTap.timerId);
        const timerId = window.setTimeout(() => {
          tapMetaRef.current = null;
          goNext();
        }, DOUBLE_TAP_MS);
        tapMetaRef.current = { at: now, x: clientX, y: e.clientY, timerId };
        return;
      }
    }
    swipeCommittedRef.current = false;
  };

  const onMainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishPointer(e, e.clientX);
  };

  const onMainPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    setDragX(0);
    setIsPaused(false);
    swipeCommittedRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const openViewersSheet = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentStoryId) onOpenViewers?.(currentStoryId);
  };

  const viewerNode = (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
      className={cn(
        "fixed inset-0 z-[320] mx-auto flex w-full max-w-[480px] flex-col overflow-hidden overscroll-none bg-[#12061d] text-white touch-manipulation",
        /* iOS Safari / старые WebView: запас до 100dvh; Android Chrome + веб: dvh */
        "h-[100svh] min-h-0 max-h-[100svh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]"
      )}
    >
      {/* Progress */}
      <div className="absolute top-0 inset-x-0 px-2 pt-[calc(env(safe-area-inset-top,0px)+8px)] flex gap-1 z-[62]">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-0.5 flex-1 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.95)] transition-[width] duration-75 ease-linear"
              style={{
                width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? "100%" : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Таймер исчезновения — отдельная строка, без наезда на шапку */}
      {remainingLabel && (
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+14px)] inset-x-0 flex justify-center z-[61] pointer-events-none px-12">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/95 shadow-lg backdrop-blur-md">
            Исчезнет через {remainingLabel}
          </span>
        </div>
      )}

      {/* Шапка: только автор и действия; просмотры убраны отсюда */}
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+44px)] z-[60] px-3 flex items-start justify-between gap-2 bg-gradient-to-b from-[#160922]/88 via-[#160922]/40 to-transparent pb-10 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="rounded-full bg-gradient-to-tr from-fuchsia-400 via-purple-400 to-cyan-300 p-[2px] shadow-[0_0_18px_rgba(232,121,249,0.45)]">
            <img
              src={currentStory.userAvatar}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-black/30 object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight text-fuchsia-200 drop-shadow-[0_0_10px_rgba(244,114,182,0.55)]">{currentStory.userName}</p>
            <p className="text-[11px] uppercase tracking-wide text-cyan-200/85">{currentStory.time}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 text-white/90 backdrop-blur-md hover:bg-white/15 active:bg-white/25"
            aria-label="Ещё"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(true);
            }}
          >
            <MoreHorizontal className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/15 bg-white/5 p-2 text-white/90 backdrop-blur-md hover:bg-white/15 active:bg-white/25"
            aria-label="Закрыть"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Контент + свайп: Pointer Events — iOS 13+ / Android WebView / десктоп; touch-manipulation убирает задержку 300ms на старых Android */}
      <div
        className="relative flex-1 cursor-pointer touch-pan-x touch-pan-y bg-zinc-950"
        style={{ WebkitTouchCallout: "none" as const }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={onMainPointerDown}
        onPointerMove={onMainPointerMove}
        onPointerUp={onMainPointerUp}
        onPointerCancel={onMainPointerCancel}
      >
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.22),transparent_42%),radial-gradient(circle_at_16%_84%,rgba(232,121,249,0.2),transparent_48%)]" />
        <motion.div
          className="absolute inset-0 z-[2] flex items-center justify-center"
          style={{ x: dragX }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        >
          <AnimatePresence mode="wait">
            {isVideoStory ? (
              <motion.video
                key={currentStory.id}
                ref={storyVideoRef}
                src={currentStory.image}
                className="h-full w-full select-none object-cover [-webkit-user-drag:none] sm:object-contain"
                autoPlay
                playsInline
                preload="auto"
                muted={storyVideoMuted}
                onTimeUpdate={onStoryVideoTimeUpdate}
                onEnded={onStoryVideoEnded}
                initial={prefersReducedMotion ? false : { opacity: 0.88, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0.75, scale: 0.99 }}
                transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
              />
            ) : (
              <motion.img
                key={currentStory.id}
                src={currentStory.image}
                alt=""
                className="h-full w-full select-none object-cover [-webkit-user-drag:none] sm:object-contain"
                draggable={false}
                decoding="async"
                initial={prefersReducedMotion ? false : { opacity: 0.88, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0.75, scale: 0.99 }}
                transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {likeBurst.map((item) => (
            <motion.div
              key={item.id}
              className="pointer-events-none absolute z-[57] text-rose-400"
              style={{ left: item.x, top: item.y }}
              initial={{ opacity: 0, scale: 0.4, x: -10, y: 8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1.08, 0.88], x: item.drift, y: -130 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.25, delay: item.delay, ease: "easeOut" }}
            >
              <Heart className="h-6 w-6 fill-current drop-shadow-[0_4px_10px_rgba(244,63,94,0.45)]" />
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {soundHudVisible && (
            <motion.div
              className="pointer-events-none absolute bottom-3 right-3 z-[58]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <motion.div
                initial={{ scale: 0.82, y: 4 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.86, y: 4 }}
                transition={{ duration: 0.18, ease: EASING_OUT_BEZIER }}
                className="rounded-full border border-cyan-200/35 bg-[#160922]/45 p-2 backdrop-blur-md shadow-[0_0_16px_rgba(56,189,248,0.35)]"
              >
                {soundHudIsMuted ? (
                  <VolumeX className="h-4 w-4 text-white/90" />
                ) : (
                  <Volume2 className="h-4 w-4 text-white/90" />
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Подсказка свайпа */}
        {stories.length > 1 && showSwipeHint && !prefersReducedMotion && (
          <>
            <motion.div
              className="pointer-events-none absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 0.55, x: 0 }}
              transition={{ duration: 0.45, ease: EASING_OUT_BEZIER }}
            >
              <ChevronLeft className="h-7 w-7 text-white" strokeWidth={2} />
            </motion.div>
            <motion.div
              className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 0.55, x: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: EASING_OUT_BEZIER }}
            >
              <ChevronRight className="h-7 w-7 text-white" strokeWidth={2} />
            </motion.div>
            <motion.p
              className="pointer-events-none absolute bottom-[28%] inset-x-0 z-10 px-4 text-center text-[11px] font-medium leading-snug text-white/85 drop-shadow-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              Удерживайте — пауза · двойной тап — звук · свайп — соседняя сториз или следующий автор в кольце
            </motion.p>
          </>
        )}
      </div>

      {/* Низ: просмотры (своя сториз), компактная строка ответа + лайк + отправить */}
      <div className="absolute bottom-0 inset-x-0 z-[60] flex flex-col gap-1.5 bg-gradient-to-t from-[#12061d] via-[#12061d]/92 to-transparent px-3 pt-4 pb-[max(10px,calc(env(safe-area-inset-bottom,0px)+8px))]">
        {isOwnCurrentStory && currentStoryId && (
          <button
            type="button"
            onClick={openViewersSheet}
            className="flex max-w-full min-h-[var(--uix-touch-min)] items-center gap-2 self-start rounded-2xl border border-fuchsia-200/20 bg-[#2d1638]/55 py-1.5 pl-1.5 pr-3 backdrop-blur-md shadow-[0_8px_26px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#2d1638]/70 active:bg-[#2d1638]/80"
            aria-label={
              viewersCount > 0
                ? `Просмотры: ${viewersCount}. Открыть список`
                : "Просмотров пока нет. Открыть список"
            }
          >
            <div className="flex -space-x-2">
              {viewerPreviewLoading ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black/80 bg-white/10">
                  <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-white/40" />
                </div>
              ) : viewerPreview.length > 0 ? (
                viewerPreview.map((v, i) => (
                  <div
                    key={v.id}
                    className={cn("relative shrink-0 rounded-full border-2 border-black/90", i > 0 && "-ml-2.5")}
                    style={{ zIndex: viewerPreview.length - i }}
                  >
                    <UserAvatar
                      avatarUrl={v.avatarUrl ? resolveUrl(v.avatarUrl) : undefined}
                      displayName={[v.displayName, v.surname].filter(Boolean).join(" ") || `ID ${v.publicId}`}
                      seed={v.id}
                      size={36}
                      className="h-9 w-9"
                    />
                  </div>
                ))
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black/80 bg-white/10">
                  <Eye className="h-4 w-4 text-white/70" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[13px] font-semibold leading-tight text-white">
                {viewersCount > 0 ? `${viewersCount} ${viewsWordRu(viewersCount)}` : "Просмотры"}
              </p>
              <p className="text-[11px] text-white/60">Нажмите, чтобы увидеть всех</p>
            </div>
          </button>
        )}

        <div className="relative">
          <div
            className={cn(
              "flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-full border border-white/22 bg-black/38 py-1 pl-3 pr-1 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-md",
              "focus-within:border-cyan-300/50 focus-within:bg-[#1f0f28]/75"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              enterKeyHint="send"
              inputMode="text"
              autoComplete="off"
              autoCorrect="on"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder={canReplyCurrentStory ? "Ответ…" : "Недоступно"}
              disabled={!canReplyCurrentStory || sendingReply}
              className={cn(
                /* 16px: без зума iOS при фокусе */
                "min-w-0 flex-1 bg-transparent py-2 text-base leading-tight text-white outline-none placeholder:text-white/50",
                (!canReplyCurrentStory || sendingReply) && "opacity-50"
              )}
              aria-label="Ответ на сториз"
            />
            <TapScaleButton
              type="button"
              haptic
              subtle
              disabled={!canLikeCurrentStory}
              className={cn(
                "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-[background,border,opacity]",
                canLikeCurrentStory
                  ? isLiked
                    ? "border-fuchsia-300/55 bg-gradient-to-br from-fuchsia-500/55 to-purple-600/45 text-rose-100 shadow-[0_0_18px_rgba(217,70,239,0.28)]"
                    : "border-white/15 bg-white/8 text-white hover:bg-white/12"
                  : "cursor-not-allowed border-white/8 bg-white/5 text-white/35"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (!canLikeCurrentStory || !currentStoryId || !onToggleLike) return;
                void onToggleLike(currentStoryId, isLiked);
              }}
              aria-label={isLiked ? "Убрать лайк" : "Лайкнуть сториз"}
            >
              <motion.span
                key={isLiked ? "on" : "off"}
                initial={prefersReducedMotion ? false : { scale: 0.86 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 24 }}
                className="relative flex items-center justify-center"
              >
                <Heart
                  className={cn("h-5 w-5", isLiked ? "fill-rose-400 text-rose-400" : "text-white")}
                  strokeWidth={2}
                />
                {likesCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border border-white/25 bg-black/55 px-0.5 text-[8px] font-bold tabular-nums leading-none text-white/95">
                    {likesCount > 99 ? "99+" : likesCount}
                  </span>
                )}
              </motion.span>
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              subtle
              disabled={!canReplyCurrentStory || sendingReply || !replyText.trim()}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-[0_6px_16px_rgba(0,0,0,0.25)] transition-[background,border,opacity]",
                !canReplyCurrentStory || sendingReply || !replyText.trim()
                  ? "border-white/10 bg-white/5 text-white/30"
                  : "border-cyan-200/55 bg-gradient-to-br from-cyan-400/85 to-fuchsia-500/75 text-white active:brightness-110"
              )}
              onClick={(e) => {
                void handleReplySend(e);
              }}
              aria-label="Отправить ответ"
            >
              <Send className="h-5 w-5" />
            </TapScaleButton>
          </div>
          {replyError && <p className="mt-1 px-1 text-[11px] text-red-300">{replyError}</p>}
        </div>
      </div>

      {showActions && (
        <div
          className="absolute inset-0 z-[360] flex items-end bg-black/50 px-3 pt-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))]"
          onClick={(e) => {
            e.stopPropagation();
            setShowActions(false);
          }}
        >
          <div
            className="mx-auto w-full max-w-[480px] rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10"
              onClick={() => {
                const id = typeof currentStory?.id === "string" ? currentStory.id : "";
                const image = currentStory?.image ?? "";
                if (!id || !onShareStory || actionsBusy) return;
                setActionsBusy(true);
                setActionError(null);
                Promise.resolve(
                  onShareStory({
                    id,
                    image,
                    userName: currentStory?.userName ?? "",
                    time: currentStory?.time ?? "",
                  })
                )
                  .then(() => setShowActions(false))
                  .catch((err: unknown) =>
                    setActionError(err instanceof Error ? err.message : "Не удалось поделиться сториз")
                  )
                  .finally(() => {
                    setActionsBusy(false);
                  });
              }}
              disabled={actionsBusy || !onShareStory}
            >
              <Share2 className="h-4 w-4" />
              Поделиться сториз
            </button>
            {isOwnCurrentStory && currentStoryId && onArchiveStory && (
              <button
                type="button"
                className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-white/10"
                onClick={() => {
                  if (actionsBusy) return;
                  setActionsBusy(true);
                  setActionError(null);
                  Promise.resolve(onArchiveStory(currentStoryId))
                    .then(() => setShowActions(false))
                    .catch((err: unknown) =>
                      setActionError(err instanceof Error ? err.message : "Не удалось архивировать сториз")
                    )
                    .finally(() => {
                      setActionsBusy(false);
                    });
                }}
                disabled={actionsBusy}
              >
                <Archive className="h-4 w-4" />
                Архивировать
              </button>
            )}
            {isOwnCurrentStory && currentStoryId && onDeleteStory && (
              <>
                {!confirmDelete ? (
                  <button
                    type="button"
                    className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-300 hover:bg-red-500/15"
                    onClick={() => {
                      setActionError(null);
                      setConfirmDelete(true);
                    }}
                    disabled={actionsBusy}
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить сториз
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3">
                    <p className="text-[12px] text-red-200">Удалить сториз без возможности восстановления?</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="min-h-[var(--uix-touch-min)] rounded-lg bg-red-500/80 px-3 py-2 text-xs font-medium text-white hover:bg-red-500"
                        onClick={() => {
                          if (actionsBusy) return;
                          setActionsBusy(true);
                          setActionError(null);
                          Promise.resolve(onDeleteStory(currentStoryId))
                            .then(() => setShowActions(false))
                            .catch((err: unknown) =>
                              setActionError(err instanceof Error ? err.message : "Не удалось удалить сториз")
                            )
                            .finally(() => {
                              setActionsBusy(false);
                            });
                        }}
                        disabled={actionsBusy}
                      >
                        Да, удалить
                      </button>
                      <button
                        type="button"
                        className="min-h-[var(--uix-touch-min)] rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white/90 hover:bg-white/20"
                        onClick={() => setConfirmDelete(false)}
                        disabled={actionsBusy}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            <button
              type="button"
              className="mt-1 flex w-full min-h-[var(--uix-touch-min)] items-center justify-center rounded-xl px-3 py-3 text-sm text-white/70 hover:bg-white/10"
              onClick={() => setShowActions(false)}
            >
              Отмена
            </button>
            {actionError && <p className="px-3 pb-2 pt-1 text-[11px] text-red-300">{actionError}</p>}
          </div>
        </div>
      )}
    </motion.div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(viewerNode, document.body);
}

function formatStoryRemainingShort(expiresAt: Date | null): string | null {
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const totalMinutes = Math.max(1, Math.ceil(diffMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} мин`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}

function viewsWordRu(n: number): string {
  const n100 = n % 100;
  if (n100 >= 11 && n100 <= 14) return "просмотров";
  const n10 = n % 10;
  if (n10 === 1) return "просмотр";
  if (n10 >= 2 && n10 <= 4) return "просмотра";
  return "просмотров";
}
