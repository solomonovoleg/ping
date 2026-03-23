import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Eye, Heart, MoreHorizontal, Send, Share2, Volume2, VolumeX, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { fetchStoryViewers, type StoryViewerUser } from "@/lib/stories";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import {
  DURATION_NORMAL_S,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

import type { Story, StoryViewerProps } from "./story-viewer/types";
export type { Story, StoryViewerProps } from "./story-viewer/types";

import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { DOUBLE_TAP_MS, STORY_SOUND_PREF_KEY } from "./story-viewer/constants";
import { getInitialStorySoundMuted } from "./story-viewer/story-sound-pref";
import { normalizeStorySlideId, viewsWordRu } from "./story-viewer/format";
import { StoryViewerActionsSheet } from "./story-viewer/StoryViewerActionsSheet";

const TAP_MOVE_MAX_PX = 10;
const TAP_MAX_MS = 220;
const H_SWIPE_START_PX = 16;
const H_SWIPE_COMMIT_PX = 58;
const V_SWIPE_START_PX = 14;
const V_SWIPE_CLOSE_COMMIT_PX = 84;

/** Снимок сториз, к которой привязано поле ответа (не меняется при автопереходе/свайпе). */
type StoryReplyBind = {
  storyId: string;
  authorId: string;
  image: string;
  thumbnailUrl?: string;
  userName: string;
  userAvatar: string;
  time: string;
};

function captureReplyBindFromStory(story: Story | undefined): StoryReplyBind | null {
  if (!story) return null;
  const storyId = normalizeStorySlideId(story.id) ?? "";
  const authorId = story.authorId ?? "";
  if (!storyId || !authorId) return null;
  return {
    storyId,
    authorId,
    image: story.image ?? "",
    ...(story.thumbnailUrl ? { thumbnailUrl: story.thumbnailUrl } : {}),
    userName: story.userName ?? "",
    userAvatar: story.userAvatar ?? "",
    time: story.time ?? "",
  };
}

export default function StoryViewer({
  stories,
  initialIndex = 0,
  onClose,
  viewerUserId,
  onStoryView,
  onOpenViewers,
  canSeeViewers = false,
  viewersCountByStoryId = {},
  onReply,
  canReply = true,
  onToggleLike,
  canLike = true,
  likedByStoryId = {},
  likesCountByStoryId = {},
  canManage = false,
  onShareStory,
  onArchiveStory,
  onDeleteStory,
  onAddToPinned,
}: StoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  /** К какой сториз относится черновик ответа (фиксируется при фокусе или первом символе). */
  const [replyBind, setReplyBind] = useState<StoryReplyBind | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [actionsBusy, setActionsBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewerPreview, setViewerPreview] = useState<StoryViewerUser[]>([]);
  const [viewerPreviewLoading, setViewerPreviewLoading] = useState(false);
  const [storyVideoMuted, setStoryVideoMuted] = useState(getInitialStorySoundMuted);
  const [soundHudVisible, setSoundHudVisible] = useState(false);
  const [soundHudIsMuted, setSoundHudIsMuted] = useState(true);
  const [likePulse, setLikePulse] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(0);

  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const soundHudTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const pointerIntentRef = useRef<"none" | "tap" | "swipe-x" | "swipe-y">("none");
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      if (soundHudTimerRef.current) window.clearTimeout(soundHudTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setClockSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setProgress(0);
  }, [initialIndex]);

  useEffect(() => {
    if (stories.length === 0) return;
    setCurrentIndex((i) => Math.min(i, stories.length - 1));
  }, [stories.length]);

  const currentStory = stories[currentIndex];
  const currentStoryId = normalizeStorySlideId(currentStory?.id);
  const currentStoryAuthorId = currentStory?.authorId ?? "";
  const isOwnCurrentStory =
    !!viewerUserId && !!currentStoryAuthorId && currentStoryAuthorId === viewerUserId;

  const canReplyCurrentStory =
    !!onReply &&
    !!currentStoryId &&
    !!currentStoryAuthorId &&
    !isOwnCurrentStory &&
    (viewerUserId ? true : canReply);

  const canReplyToBind =
    !!onReply &&
    !!replyBind &&
    !!viewerUserId &&
    replyBind.authorId !== viewerUserId &&
    (viewerUserId ? true : canReply);

  /** Пока пишешь ответ — нельзя уйти на другую сториз (таймер, видео, свайп, тап по краям). */
  const replyNavigationBlocked =
    replyBind !== null && (replyFocused || replyText.trim().length > 0);

  /** Держим на экране ту сториз, которой отвечаем, пока активен черновик. */
  useEffect(() => {
    if (!replyBind || !replyNavigationBlocked) return;
    const idx = stories.findIndex((s) => normalizeStorySlideId(s.id) === replyBind.storyId);
    if (idx >= 0 && idx !== currentIndex) setCurrentIndex(idx);
  }, [replyBind, replyNavigationBlocked, stories, currentIndex]);

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

  const isVideoStory = isLikelyStoryVideoUrl(currentStory?.image ?? "");
  const timerStr = useMemo(
    () =>
      `${String(Math.floor(clockSeconds / 60)).padStart(2, "0")}:${String(
        clockSeconds % 60
      ).padStart(2, "0")}`,
    [clockSeconds]
  );

  useEffect(() => {
    if (!currentStoryId || !onStoryView) return;
    onStoryView(currentStoryId);
  }, [currentStoryId, onStoryView]);

  useEffect(() => {
    setProgress(0);
    setReplyError(null);
    setActionError(null);
    setConfirmDelete(false);
    setDoubleTapHeart(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!isOwnCurrentStory || !currentStoryId || !canSeeViewers) {
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
  }, [canSeeViewers, currentStoryId, isOwnCurrentStory]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORY_SOUND_PREF_KEY, storyVideoMuted ? "1" : "0");
  }, [storyVideoMuted]);

  useEffect(() => {
    if (!isVideoStory) return;
    const preferredMuted = getInitialStorySoundMuted();
    setStoryVideoMuted(preferredMuted);
    setSoundHudVisible(false);
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
  }, [currentStory?.id, isVideoStory]);

  useEffect(() => {
    const v = storyVideoRef.current;
    if (!v || !isVideoStory) return;
    if (paused) v.pause();
    else {
      void v.play().catch(() => {
        v.muted = true;
        setStoryVideoMuted(true);
      });
    }
  }, [isVideoStory, paused, currentStory?.id]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
      return;
    }
    onClose?.();
  }, [currentIndex, onClose, stories.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
      return;
    }
    setProgress(0);
  }, [currentIndex]);

  const goNextAuthor = useCallback(() => {
    const currentAuthor = stories[currentIndex]?.authorId ?? "";
    if (!currentAuthor) return false;
    for (let i = currentIndex + 1; i < stories.length; i += 1) {
      if ((stories[i]?.authorId ?? "") !== currentAuthor) {
        setCurrentIndex(i);
        setProgress(0);
        return true;
      }
    }
    return false;
  }, [currentIndex, stories]);

  const goPrevAuthor = useCallback(() => {
    const currentAuthor = stories[currentIndex]?.authorId ?? "";
    if (!currentAuthor) return false;
    for (let i = currentIndex - 1; i >= 0; i -= 1) {
      if ((stories[i]?.authorId ?? "") !== currentAuthor) {
        setCurrentIndex(i);
        setProgress(0);
        return true;
      }
    }
    return false;
  }, [currentIndex, stories]);

  /** Явный жест «другая сториз» — черновик ответа сбрасывается (передумал писать). */
  const discardReplyDraft = useCallback(() => {
    setReplyText("");
    setReplyBind(null);
    setReplyFocused(false);
    setReplyError(null);
    setActionError(null);
  }, []);

  const safeGoNext = useCallback(() => {
    if (replyNavigationBlocked) discardReplyDraft();
    goNext();
  }, [discardReplyDraft, goNext, replyNavigationBlocked]);

  const safeGoPrev = useCallback(() => {
    if (replyNavigationBlocked) discardReplyDraft();
    goPrev();
  }, [discardReplyDraft, goPrev, replyNavigationBlocked]);

  const safeGoNextAuthor = useCallback(() => {
    if (replyNavigationBlocked) discardReplyDraft();
    return goNextAuthor();
  }, [discardReplyDraft, goNextAuthor, replyNavigationBlocked]);

  const safeGoPrevAuthor = useCallback(() => {
    if (replyNavigationBlocked) discardReplyDraft();
    return goPrevAuthor();
  }, [discardReplyDraft, goPrevAuthor, replyNavigationBlocked]);

  useEffect(() => {
    if (paused || isVideoStory || !stories.length || replyNavigationBlocked) return;
    const interval = 60;
    const duration = 5000;
    const step = interval / duration;
    const t = window.setInterval(() => {
      setProgress((p) => {
        if (p + step >= 1) {
          safeGoNext();
          return 0;
        }
        return p + step;
      });
    }, interval);
    return () => window.clearInterval(t);
  }, [isVideoStory, paused, replyNavigationBlocked, safeGoNext, stories.length, currentIndex]);

  const onStoryVideoTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
    setProgress(Math.min(1, v.currentTime / v.duration));
  }, []);

  const onStoryVideoEnded = useCallback(() => {
    if (replyNavigationBlocked) {
      const v = storyVideoRef.current;
      if (v) {
        try {
          v.pause();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    safeGoNext();
  }, [replyNavigationBlocked, safeGoNext]);

  const submitStoryReply = useCallback(() => {
    const text = replyText.trim();
    const bind = replyBind ?? captureReplyBindFromStory(currentStory);
    if (!bind) return;
    if (!text || !onReply || sendingReply) return;
    if (!viewerUserId || bind.authorId === viewerUserId) return;
    setSendingReply(true);
    setReplyError(null);
    setActionError(null);
    Promise.resolve(
      onReply({
        storyId: bind.storyId,
        authorId: bind.authorId,
        text,
        story: {
          id: bind.storyId,
          image: bind.image,
          ...(bind.thumbnailUrl ? { thumbnailUrl: bind.thumbnailUrl } : {}),
          userName: bind.userName,
          userAvatar: bind.userAvatar,
          time: bind.time,
        },
      })
    )
      .then(() => {
        setReplyText("");
        setReplyBind(null);
      })
      .catch((err: unknown) =>
        setReplyError(err instanceof Error ? err.message : "Failed to send reply")
      )
      .finally(() => setSendingReply(false));
  }, [currentStory, onReply, replyBind, replyText, sendingReply, viewerUserId]);

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submitStoryReply();
  };

  const triggerLike = useCallback(() => {
    if (!canLikeCurrentStory || !currentStoryId || !onToggleLike) return;
    void onToggleLike(currentStoryId, isLiked);
    if (!prefersReducedMotion) {
      setLikePulse(true);
      window.setTimeout(() => setLikePulse(false), 520);
    }
  }, [canLikeCurrentStory, currentStoryId, isLiked, onToggleLike, prefersReducedMotion]);

  const onMainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    pointerIntentRef.current = "tap";
    setPaused(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onMainPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (pointerIntentRef.current === "tap") {
      if (absX <= TAP_MOVE_MAX_PX && absY <= TAP_MOVE_MAX_PX) return;
      if (absY > absX && absY > V_SWIPE_START_PX) {
        pointerIntentRef.current = "swipe-y";
        return;
      }
      if (absX > absY && absX > H_SWIPE_START_PX) {
        pointerIntentRef.current = "swipe-x";
        return;
      }
      pointerIntentRef.current = "none";
    }
  };

  const finishMainPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setPaused(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const heldMs = Date.now() - start.at;
    const intent = pointerIntentRef.current;
    pointerIntentRef.current = "none";

    if (intent === "swipe-y") {
      if (dy < -V_SWIPE_CLOSE_COMMIT_PX && absY > absX * 1.15) onClose?.();
      return;
    }

    if (intent === "swipe-x") {
      if (absX < H_SWIPE_COMMIT_PX || absX < absY * 1.1) return;
      if (dx < 0) {
        if (!safeGoNextAuthor()) safeGoNext();
      } else {
        if (!safeGoPrevAuthor()) safeGoPrev();
      }
      return;
    }

    if (absX > TAP_MOVE_MAX_PX || absY > TAP_MOVE_MAX_PX) return;
    if (heldMs > TAP_MAX_MS) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const now = Date.now();
    const prevTap = lastTapRef.current;
    const isDoubleTap =
      !!prevTap &&
      now - prevTap.at <= DOUBLE_TAP_MS &&
      Math.hypot(e.clientX - prevTap.x, e.clientY - prevTap.y) < 56;

    if (isDoubleTap) {
      if (canLikeCurrentStory) {
        triggerLike();
        setDoubleTapHeart(true);
        window.setTimeout(() => setDoubleTapHeart(false), 900);
      } else if (isVideoStory) {
        toggleStorySound();
      }
      lastTapRef.current = null;
      return;
    }

    lastTapRef.current = { at: now, x: e.clientX, y: e.clientY };
    if (x <= rect.width * 0.32) {
      safeGoPrev();
      return;
    }
    if (x >= rect.width * 0.68) {
      safeGoNext();
    }
  };

  const onMainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishMainPointer(e);
  };

  const onMainPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    pointerIntentRef.current = "none";
    setPaused(false);
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

  const runShare = useCallback(
    (closeSheet = false) => {
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
        .then(() => {
          if (closeSheet) setShowActions(false);
        })
        .catch((err: unknown) => {
          if (isNavigatorShareCancelled(err)) return;
          setActionError(err instanceof Error ? err.message : "Failed to share story");
        })
        .finally(() => setActionsBusy(false));
    },
    [actionsBusy, currentStory?.id, currentStory?.image, currentStory?.time, currentStory?.userName, onShareStory]
  );

  const handleActionSheetArchive = () => {
    if (!currentStoryId || !onArchiveStory || actionsBusy) return;
    setActionsBusy(true);
    setActionError(null);
    Promise.resolve(onArchiveStory(currentStoryId))
      .then(() => setShowActions(false))
      .catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : "Failed to archive story")
      )
      .finally(() => setActionsBusy(false));
  };

  const handleActionSheetDeleteConfirm = () => {
    if (!currentStoryId || !onDeleteStory || actionsBusy) return;
    setActionsBusy(true);
    setActionError(null);
    Promise.resolve(onDeleteStory(currentStoryId))
      .then(() => setShowActions(false))
      .catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : "Failed to delete story")
      )
      .finally(() => setActionsBusy(false));
  };

  if (!stories.length || !currentStory) return null;

  const viewerNode = (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
      className={cn(
        "fixed inset-0 z-[320] mx-auto flex w-full max-w-[480px] flex-col overflow-hidden overscroll-none bg-black text-white touch-manipulation",
        "h-[100svh] min-h-0 max-h-[100svh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]"
      )}
      style={{
        fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
      }}
    >
      <style>{`
        @keyframes svHeartPop { 0%{transform:scale(0.5);opacity:0} 40%{transform:scale(1.35);opacity:1} 70%{transform:scale(0.95)} 100%{transform:scale(1);opacity:1} }
        @keyframes svHeartBig { 0%{transform:translate(-50%,-50%) scale(0);opacity:0} 20%{transform:translate(-50%,-50%) scale(1.3);opacity:1} 70%{opacity:1} 100%{transform:translate(-50%,-50%) scale(1.1);opacity:0} }
        @keyframes svFadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div
        className="absolute inset-0 z-[1]"
        onPointerDown={onMainPointerDown}
        onPointerMove={onMainPointerMove}
        onPointerUp={onMainPointerUp}
        onPointerCancel={onMainPointerCancel}
        style={{ touchAction: "none" }}
      >
        {isVideoStory ? (
          <video
            ref={storyVideoRef}
            src={currentStory.image}
            className="h-full w-full object-cover"
            playsInline
            muted={storyVideoMuted}
            autoPlay
            preload="metadata"
            onTimeUpdate={onStoryVideoTimeUpdate}
            onEnded={onStoryVideoEnded}
          />
        ) : (
          <img
            src={currentStory.image}
            alt={currentStory.userName || "Story"}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 24%, transparent 62%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {doubleTapHeart ? (
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] z-[55]"
          style={{
            fontSize: 88,
            lineHeight: 1,
            animation: "svHeartBig 0.9s ease forwards",
            filter: "drop-shadow(0 4px 16px rgba(251,113,133,0.6))",
          }}
        >
          ❤️
        </div>
      ) : null}

      {soundHudVisible && isVideoStory ? (
        <div className="pointer-events-none absolute left-1/2 top-[44%] z-[56] -translate-x-1/2 rounded-full bg-black/45 px-4 py-2 backdrop-blur-md">
          <span className="text-xs font-semibold text-white/90">
            {soundHudIsMuted ? "Sound off" : "Sound on"}
          </span>
        </div>
      ) : null}

      <div className="absolute left-0 right-0 top-0 z-[20] px-3 pt-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[13px] font-bold text-white">{timerStr}</span>
          <div className="flex items-center gap-2 text-[12px] text-white/90">
            <span>{isVideoStory ? "Video" : "Story"}</span>
          </div>
        </div>

        <div className="mb-2 flex gap-1">
          {stories.map((s, i) => {
            const fill = i < currentIndex ? 1 : i === currentIndex ? progress : 0;
            return (
              <div
                key={normalizeStorySlideId(s.id) ?? i}
                className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${Math.max(0, Math.min(1, fill)) * 100}%`,
                    transition: i === currentIndex ? "none" : "width 0.3s ease",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <img
            src={currentStory.userAvatar}
            alt={currentStory.userName || "Author"}
            className="h-9 w-9 rounded-full border-2 border-white/80 object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-bold text-white">
                {currentStory.userName || "Unknown"}
              </span>
              <span className="text-xs text-white/70">{currentStory.time || ""}</span>
            </div>
          </div>

          {isVideoStory ? (
            <button
              type="button"
              aria-label={storyVideoMuted ? "Unmute story" : "Mute story"}
              onClick={(e) => {
                e.stopPropagation();
                toggleStorySound();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/90"
            >
              {storyVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          ) : null}

          <button
            type="button"
            aria-label="More actions"
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(true);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/90"
          >
            <MoreHorizontal size={17} />
          </button>
          <button
            type="button"
            aria-label="Close stories"
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white/90"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[24] px-3 pb-[max(14px,calc(env(safe-area-inset-bottom,0px)+14px))]">
        {isOwnCurrentStory ? (
          <div
            onClick={openViewersSheet}
            className="flex min-h-[var(--uix-touch-min)] cursor-pointer items-center gap-3 rounded-[26px] border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl"
          >
            <div className="flex items-center">
              {viewerPreviewLoading ? (
                <div className="h-6 w-16 rounded-full bg-white/15" />
              ) : viewerPreview.length ? (
                viewerPreview.map((v, i) => (
                  <img
                    key={`${v.id}-${i}`}
                    src={v.avatarUrl || ""}
                    alt={[v.displayName, v.surname].filter(Boolean).join(" ").trim() || "Viewer"}
                    className={cn(
                      "h-6 w-6 rounded-full border border-black/60 object-cover",
                      i > 0 ? "-ml-2" : ""
                    )}
                  />
                ))
              ) : (
                <div className="h-6 w-6 rounded-full bg-white/15" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{viewersCount}</p>
                <p className="truncate text-[11px] text-white/65">{viewsWordRu(viewersCount)}</p>
              </div>
              <div className="flex items-center gap-1 text-white/65">
                <Eye size={14} />
                <span className="text-xs font-medium">Viewers</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex min-h-[var(--uix-touch-min)] flex-1 flex-col gap-1 rounded-[26px] border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-xl">
              {replyBind && replyNavigationBlocked ? (
                <p className="text-[11px] leading-tight text-white/80">
                  Ответ для{" "}
                  <span className="font-semibold text-white">{replyBind.userName || "автора"}</span>
                </p>
              ) : null}
              <div className="flex w-full min-w-0 flex-1 items-center">
              <input
                value={replyText}
                onChange={(e) => {
                  const v = e.target.value;
                  setReplyText(v);
                  if (replyError) setReplyError(null);
                  if (actionError) setActionError(null);
                  if (v.trim() && !replyBind && canReplyCurrentStory) {
                    const next = captureReplyBindFromStory(currentStory);
                    if (next) setReplyBind(next);
                  }
                }}
                onFocus={() => {
                  setReplyFocused(true);
                  setActionError(null);
                  if (!replyBind && canReplyCurrentStory) {
                    const next = captureReplyBindFromStory(currentStory);
                    if (next) setReplyBind(next);
                  }
                }}
                onBlur={() => {
                  setReplyFocused(false);
                  if (!replyText.trim()) setReplyBind(null);
                }}
                onKeyDown={handleReplyKeyDown}
                placeholder={
                  replyBind
                    ? `Сообщение для ${replyBind.userName || "…"}`
                    : canReplyCurrentStory
                      ? "Сообщение…"
                      : "Ответ недоступен"
                }
                disabled={(!replyBind ? !canReplyCurrentStory : !canReplyToBind) || sendingReply}
                className="w-full min-w-0 bg-transparent text-sm text-white placeholder:text-white/65 outline-none disabled:cursor-not-allowed disabled:text-white/65"
                aria-label={replyBind ? `Ответ на сториз ${replyBind.userName || ""}` : "Ответ на сториз"}
              />
              {(replyBind ? canReplyToBind : canReplyCurrentStory) && replyText.trim() ? (
                <button
                  type="button"
                  aria-label="Send reply"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitStoryReply();
                  }}
                  disabled={sendingReply}
                  className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-white disabled:opacity-60"
                >
                  <Send size={14} />
                </button>
              ) : null}
              </div>
            </div>

            <button
              type="button"
              aria-label={isLiked ? "Unlike story" : "Like story"}
              onClick={(e) => {
                e.stopPropagation();
                triggerLike();
              }}
              disabled={!canLikeCurrentStory}
              className="flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-55"
              style={{
                animation: likePulse && !prefersReducedMotion ? "svHeartPop 0.55s cubic-bezier(0.175,0.885,0.32,1.275)" : "none",
              }}
            >
              <Heart size={20} color={isLiked ? "#fb7185" : "white"} fill={isLiked ? "#fb7185" : "none"} />
            </button>

            <button
              type="button"
              aria-label="Share story"
              onClick={(e) => {
                e.stopPropagation();
                runShare(false);
              }}
              disabled={!onShareStory || actionsBusy}
              className="flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Share2 size={18} color="white" />
            </button>
          </div>
        )}

        {!isOwnCurrentStory && likesCount > 0 ? (
          <p className="mt-2 px-2 text-[11px] text-white/75">{likesCount} likes</p>
        ) : null}
        {replyError ? <p className="mt-2 px-2 text-[11px] text-red-300">{replyError}</p> : null}
        {actionError && !showActions ? (
          <p className="mt-2 px-2 text-[11px] text-red-300">{actionError}</p>
        ) : null}
      </div>

      <StoryViewerActionsSheet
        open={showActions}
        onDismiss={() => setShowActions(false)}
        actionError={actionError}
        actionsBusy={actionsBusy}
        shareDisabled={!onShareStory}
        onShare={() => runShare(true)}
        showAddToPinned={!!((isOwnCurrentStory || canManage) && currentStoryId && onAddToPinned)}
        onAddToPinned={() => {
          if (currentStoryId) onAddToPinned?.(currentStoryId);
        }}
        showArchive={!!((isOwnCurrentStory || canManage) && currentStoryId && onArchiveStory)}
        onArchive={handleActionSheetArchive}
        showDelete={!!((isOwnCurrentStory || canManage) && currentStoryId && onDeleteStory)}
        confirmDelete={confirmDelete}
        onRequestDeleteConfirm={() => {
          setActionError(null);
          setConfirmDelete(true);
        }}
        onCancelDeleteConfirm={() => setConfirmDelete(false)}
        onConfirmDelete={handleActionSheetDeleteConfirm}
      />
    </motion.div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(viewerNode, document.body);
}
