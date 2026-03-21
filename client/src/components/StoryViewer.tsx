import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { fetchStoryViewers, type StoryViewerUser } from "@/lib/stories";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import {
  DURATION_NORMAL_S,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

import type { StoryViewerProps } from "./story-viewer/types";
export type { Story, StoryViewerProps } from "./story-viewer/types";

import { SWIPE_PX, DOUBLE_TAP_MS, TAP_MOVE_MAX_PX, STORY_SOUND_PREF_KEY } from "./story-viewer/constants";
import { getInitialStorySoundMuted } from "./story-viewer/story-sound-pref";
import { formatStoryRemainingShort, normalizeStorySlideId } from "./story-viewer/format";
import { StoryViewerKeyframes } from "./story-viewer/StoryViewerKeyframes";
import { StoryViewerHeader } from "./story-viewer/StoryViewerHeader";
import { StoryViewerMediaArea } from "./story-viewer/StoryViewerMediaArea";
import { StoryViewerFooterOwn } from "./story-viewer/StoryViewerFooterOwn";
import { StoryViewerFooterOther } from "./story-viewer/StoryViewerFooterOther";
import { StoryViewerActionsSheet } from "./story-viewer/StoryViewerActionsSheet";

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
  const [likeButtonPulse, setLikeButtonPulse] = useState(false);

  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeCommittedRef = useRef(false);
  const tapMetaRef = useRef<{ at: number; x: number; y: number; timerId: number | null } | null>(null);
  const soundHudTimerRef = useRef<number | null>(null);
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
    const sid = normalizeStorySlideId(s?.id);
    if (s && onStoryView && sid) {
      onStoryView(sid);
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
  const currentStoryId = normalizeStorySlideId(currentStory?.id);
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

  const submitStoryReply = useCallback(() => {
    const text = replyText.trim();
    const storyId = normalizeStorySlideId(currentStory?.id) ?? "";
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
  }, [replyText, currentStory, onReply, sendingReply]);

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    submitStoryReply();
  };

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

  const onMainPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    swipeCommittedRef.current = false;
    setDragX(0);
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
          if (isVideoStory) toggleStorySound();
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

  const handleFooterShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      .then(() => setActionError(null))
      .catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : "Не удалось поделиться")
      )
      .finally(() => setActionsBusy(false));
  };

  const handleActionSheetShare = () => {
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
      .finally(() => setActionsBusy(false));
  };

  const handleActionSheetArchive = () => {
    if (!currentStoryId || !onArchiveStory || actionsBusy) return;
    setActionsBusy(true);
    setActionError(null);
    Promise.resolve(onArchiveStory(currentStoryId))
      .then(() => setShowActions(false))
      .catch((err: unknown) =>
        setActionError(err instanceof Error ? err.message : "Не удалось архивировать сториз")
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
        setActionError(err instanceof Error ? err.message : "Не удалось удалить сториз")
      )
      .finally(() => setActionsBusy(false));
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canLikeCurrentStory || !currentStoryId || !onToggleLike) return;
    void onToggleLike(currentStoryId, isLiked);
    if (!prefersReducedMotion) {
      setLikeButtonPulse(true);
      window.setTimeout(() => setLikeButtonPulse(false), 520);
    }
  };

  const viewerNode = (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
      className={cn(
        "fixed inset-0 z-[320] mx-auto flex w-full max-w-[480px] flex-col overflow-hidden overscroll-none bg-black font-[system-ui,-apple-system,BlinkMacSystemFont,'Inter',sans-serif] text-white touch-manipulation",
        "h-[100svh] min-h-0 max-h-[100svh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]"
      )}
    >
      <StoryViewerKeyframes />

      <StoryViewerHeader
        stories={stories}
        currentIndex={currentIndex}
        progress={progress}
        currentStory={currentStory}
        isOwnCurrentStory={isOwnCurrentStory}
        remainingLabel={remainingLabel}
        expiresAt={expiresAt}
        isVideoStory={isVideoStory}
        storyVideoMuted={storyVideoMuted}
        onToggleSound={() => toggleStorySound()}
        onOpenActions={() => setShowActions(true)}
        onClose={() => onClose?.()}
      />

      <StoryViewerMediaArea
        currentStory={currentStory}
        isVideoStory={isVideoStory}
        storyVideoRef={storyVideoRef}
        storyVideoMuted={storyVideoMuted}
        onStoryVideoTimeUpdate={onStoryVideoTimeUpdate}
        onStoryVideoEnded={onStoryVideoEnded}
        prefersReducedMotion={prefersReducedMotion}
        dragX={dragX}
        onMainPointerDown={onMainPointerDown}
        onMainPointerMove={onMainPointerMove}
        onMainPointerUp={onMainPointerUp}
        onMainPointerCancel={onMainPointerCancel}
        soundHudVisible={soundHudVisible}
        soundHudIsMuted={soundHudIsMuted}
        storiesLength={stories.length}
        showSwipeHint={showSwipeHint}
      />

      <div className="z-[60] shrink-0 px-3 pt-2 pb-[max(10px,calc(env(safe-area-inset-bottom,0px)+10px))]">
        {isOwnCurrentStory && currentStoryId ? (
          <StoryViewerFooterOwn
            prefersReducedMotion={prefersReducedMotion}
            viewersCount={viewersCount}
            viewerPreview={viewerPreview}
            viewerPreviewLoading={viewerPreviewLoading}
            onOpenViewers={openViewersSheet}
          />
        ) : null}

        {!isOwnCurrentStory ? (
          <StoryViewerFooterOther
            replyText={replyText}
            onReplyTextChange={setReplyText}
            onReplyKeyDown={handleReplyKeyDown}
            onReplySubmit={submitStoryReply}
            canReplyCurrentStory={canReplyCurrentStory}
            sendingReply={sendingReply}
            replyError={replyError}
            actionError={actionError}
            showActions={showActions}
            canLikeCurrentStory={canLikeCurrentStory}
            isLiked={isLiked}
            likesCount={likesCount}
            likeButtonPulse={likeButtonPulse}
            onLikeClick={handleLikeClick}
            onShareClick={handleFooterShareClick}
            shareDisabled={!onShareStory || actionsBusy}
          />
        ) : null}
      </div>

      <StoryViewerActionsSheet
        open={showActions}
        onDismiss={() => setShowActions(false)}
        actionError={actionError}
        actionsBusy={actionsBusy}
        shareDisabled={!onShareStory}
        onShare={handleActionSheetShare}
        showArchive={!!(isOwnCurrentStory && currentStoryId && onArchiveStory)}
        onArchive={handleActionSheetArchive}
        showDelete={!!(isOwnCurrentStory && currentStoryId && onDeleteStory)}
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
