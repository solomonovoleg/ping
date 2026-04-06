import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Heart, MoreHorizontal, Send, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useLocation } from "wouter";

import { cn } from "@/lib/utils";
import type { StoryViewerUser } from "@/lib/stories";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import { buildProfilePath } from "@/lib/profile-route";
import {
  DURATION_FAST_MS,
  DURATION_FAST_S,
  DURATION_NORMAL_MS,
  DURATION_NORMAL_S,
  EASING_OUT,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { triggerErrorFeedback, triggerTapFeedback } from "@/lib/micro-feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";

import type { Story, StoryViewerProps } from "./story-viewer/types";
export type { Story, StoryViewerAnalyticsEvent, StoryViewerProps } from "./story-viewer/types";

import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { DOUBLE_TAP_MS, STORY_SOUND_PREF_KEY, PULSE_IG_GRAD } from "./story-viewer/constants";
import {
  storyHorizontalShouldCommit,
  storyVerticalCloseShouldCommit,
} from "./story-viewer/story-gesture-physics";
import { computeStoryParallaxTx, computeStoryPeekStripWidth } from "./story-viewer/story-parallax";
import {
  getInitialStorySoundMuted,
  getStoryVideoVolume,
  isMediaPlayNotAllowedError,
  setStoryVideoVolume,
} from "./story-viewer/story-sound-pref";
import { normalizeStorySlideId, viewsWordRu } from "./story-viewer/format";
import { StoryViewerActionsSheet } from "./story-viewer/StoryViewerActionsSheet";
import { fetchStoryViewersCached } from "./story-viewer/story-viewers-cache";
import {
  clearStoryPrefetchSession,
  prefetchStoryMediaLowPriority,
  scheduleIdlePrefetch,
} from "./story-viewer/prefetch-media";
import { useImmersiveDarkChrome } from "@/hooks/use-immersive-dark-chrome";
import { toast } from "@/hooks/use-toast";
import { ReportContentDialog, block01ugcRu } from "@/features/store-moderation/block-01-ugc";

/** Тост после отправки ответа на сториз (короткий, без дубля с хендлерами страниц). */
const STORY_REPLY_SENT_TOAST_MS = 800;

const TAP_MOVE_MAX_PX = 12;
const TAP_MAX_MS = 220;
const H_SWIPE_START_PX = 12;
const V_SWIPE_START_PX = 12;
const CLOSE_DRAG_RESIST = 0.68;
const SOUND_FADE_IN_MS = 88;
/** Тап «назад / вперёд» — ровно трети экрана, как в Instagram */
const TAP_ZONE_THIRD = 1 / 3;
/** Spring-back горизонтального свайпа при отмене */
const STORY_H_REBOUND_MS = 420;

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

/** Индекс первой сториз следующего автора (как у goNextAuthor), иначе null. */
function resolveNextAuthorPeekIndex(stories: Story[], currentIndex: number): number | null {
  const curAid = stories[currentIndex]?.authorId ?? "";
  if (!curAid) {
    return currentIndex + 1 < stories.length ? currentIndex + 1 : null;
  }
  for (let i = currentIndex + 1; i < stories.length; i += 1) {
    if ((stories[i]?.authorId ?? "") !== curAid) return i;
  }
  return null;
}

/** Индекс сториз при goPrevAuthor (последняя сториз предыдущего автора в цепочке). */
function resolvePrevAuthorPeekIndex(stories: Story[], currentIndex: number): number | null {
  const curAid = stories[currentIndex]?.authorId ?? "";
  if (!curAid) {
    return currentIndex > 0 ? currentIndex - 1 : null;
  }
  for (let i = currentIndex - 1; i >= 0; i -= 1) {
    if ((stories[i]?.authorId ?? "") !== curAid) return i;
  }
  return null;
}

function storyPeekImageSrc(story: Story | undefined): string {
  if (!story) return "";
  return story.thumbnailUrl?.trim() || story.image || "";
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
  sessionResumeKey,
  onStoryViewerAnalytics,
}: StoryViewerProps) {
  const [, setLocation] = useLocation();
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
  const [documentHidden, setDocumentHidden] = useState(
    () => typeof document !== "undefined" && document.hidden
  );
  const [dragVisual, setDragVisual] = useState<{ x: number; active: boolean }>({ x: 0, active: false });
  const [mediaStatus, setMediaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [mediaRetryKey, setMediaRetryKey] = useState(0);
  const [navEdgeFlash, setNavEdgeFlash] = useState<"left" | "right" | null>(null);
  const [likeBloom, setLikeBloom] = useState<{ x: number; y: number } | null>(null);
  const [closeDragY, setCloseDragY] = useState(0);
  const [closeGestureActive, setCloseGestureActive] = useState(false);
  const [replyExitConfirmOpen, setReplyExitConfirmOpen] = useState(false);
  const [reportStoryOpen, setReportStoryOpen] = useState(false);
  const [a11ySlideStatus, setA11ySlideStatus] = useState("");
  /** Возврат параллакса к 0 после незавершённого горизонтального жеста */
  const [horizRebound, setHorizRebound] = useState<{ value: number; sliding: boolean } | null>(null);
  const [progressScrubbing, setProgressScrubbing] = useState(false);

  const storyVideoRef = useRef<HTMLVideoElement | null>(null);
  const soundHudTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef<{ at: number; x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number; atPerf: number } | null>(null);
  const gestureTrackRef = useRef<{ lastX: number; lastY: number; t: number }>({
    lastX: 0,
    lastY: 0,
    t: 0,
  });
  const pointerIntentRef = useRef<"none" | "tap" | "swipe-x" | "swipe-y">("none");
  const prevAuthorIdRef = useRef<string | null>(null);
  const openTimeRef = useRef(Date.now());
  const firstFrameAnalyticsSentRef = useRef(false);
  const prevSlideIndexRef = useRef<number | null>(null);
  const volumeRampCancelRef = useRef<(() => void) | null>(null);
  const onStoryViewerAnalyticsRef = useRef(onStoryViewerAnalytics);
  onStoryViewerAnalyticsRef.current = onStoryViewerAnalytics;
  const prefersReducedMotion = usePrefersReducedMotion();
  useImmersiveDarkChrome(true);

  const dragFlushRafRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, hasDx: false, closeY: 0, hasClose: false });
  const progressRowRef = useRef<HTMLDivElement | null>(null);
  const progressScrubPointerRef = useRef<number | null>(null);
  const horizReboundRafRef = useRef<number | null>(null);
  const videoProgressRafRef = useRef<number | null>(null);
  const pendingVideoProgressRef = useRef(0);

  const schedulePointerDragFlush = useCallback(() => {
    if (dragFlushRafRef.current != null) return;
    dragFlushRafRef.current = requestAnimationFrame(() => {
      dragFlushRafRef.current = null;
      const p = dragPendingRef.current;
      if (p.hasDx) setDragVisual({ x: p.dx, active: true });
      if (p.hasClose) {
        setCloseGestureActive(true);
        setCloseDragY(p.closeY);
      }
    });
  }, []);

  const photoStoryDurationMs = prefersReducedMotion ? 8200 : 5000;

  const runtimePaused = paused || showActions || documentHidden || replyFocused || reportStoryOpen;

  useEffect(() => {
    setMounted(true);
    openTimeRef.current = Date.now();
    firstFrameAnalyticsSentRef.current = false;
    prevSlideIndexRef.current = null;
    return () => {
      setMounted(false);
      if (soundHudTimerRef.current) window.clearTimeout(soundHudTimerRef.current);
      volumeRampCancelRef.current?.();
      volumeRampCancelRef.current = null;
      if (dragFlushRafRef.current != null) cancelAnimationFrame(dragFlushRafRef.current);
      if (horizReboundRafRef.current != null) cancelAnimationFrame(horizReboundRafRef.current);
      if (videoProgressRafRef.current != null) cancelAnimationFrame(videoProgressRafRef.current);
      clearStoryPrefetchSession();
    };
  }, []);

  useEffect(() => {
    const onVis = () => setDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    prefetchStoryMediaLowPriority(stories[currentIndex + 1]);
    prefetchStoryMediaLowPriority(stories[currentIndex - 1]);
    const nextAuthIdx = resolveNextAuthorPeekIndex(stories, currentIndex);
    if (nextAuthIdx != null) prefetchStoryMediaLowPriority(stories[nextAuthIdx]);
    const prevAuthIdx = resolvePrevAuthorPeekIndex(stories, currentIndex);
    if (prevAuthIdx != null) prefetchStoryMediaLowPriority(stories[prevAuthIdx]);
    const cancelIdle = scheduleIdlePrefetch(() => {
      prefetchStoryMediaLowPriority(stories[currentIndex + 2]);
      prefetchStoryMediaLowPriority(stories[currentIndex - 2]);
    });
    return cancelIdle;
  }, [currentIndex, stories]);

  useEffect(() => {
    let next = initialIndex;
    if (sessionResumeKey && stories.length > 0) {
      try {
        const raw = sessionStorage.getItem(`ping:story-resume:${sessionResumeKey}`);
        if (raw != null && raw !== "") {
          const idx = Number.parseInt(raw, 10);
          if (Number.isFinite(idx) && idx >= 0 && idx < stories.length) {
            next = idx;
          }
        }
      } catch {
        /* ignore */
      }
    }
    setCurrentIndex(next);
    setProgress(0);
  }, [initialIndex, sessionResumeKey, stories.length]);

  useEffect(() => {
    if (stories.length === 0) return;
    setCurrentIndex((i) => Math.min(i, stories.length - 1));
  }, [stories.length]);

  const currentStory = stories[currentIndex];

  const authorAwarePeek = useMemo(() => {
    const nextAuth = resolveNextAuthorPeekIndex(stories, currentIndex);
    const nextIdx =
      nextAuth !== null ? nextAuth : currentIndex + 1 < stories.length ? currentIndex + 1 : null;
    const prevAuth = resolvePrevAuthorPeekIndex(stories, currentIndex);
    const prevIdx = prevAuth !== null ? prevAuth : currentIndex > 0 ? currentIndex - 1 : null;
    return {
      nextPeek: nextIdx !== null ? stories[nextIdx] : undefined,
      prevPeek: prevIdx !== null ? stories[prevIdx] : undefined,
    };
  }, [stories, currentIndex]);

  const storyParallaxOpts = useMemo(
    () => ({
      hasNextPeek: !!authorAwarePeek.nextPeek,
      hasPrevPeek: !!authorAwarePeek.prevPeek,
      atLastNoNext: !authorAwarePeek.nextPeek && currentIndex >= stories.length - 1,
      atFirstNoPrev: !authorAwarePeek.prevPeek && currentIndex <= 0,
    }),
    [authorAwarePeek.nextPeek, authorAwarePeek.prevPeek, currentIndex, stories.length],
  );

  const prevNavIndexRef = useRef(currentIndex);
  const navDir =
    currentIndex !== prevNavIndexRef.current
      ? currentIndex > prevNavIndexRef.current
        ? 1
        : -1
      : 0;
  prevNavIndexRef.current = currentIndex;

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
  /** Глобальные индексы слайдов только текущего автора — как в Instagram, не вся склейка ленты. */
  const progressSegmentGlobalIndices = useMemo(() => {
    const aid = currentStoryAuthorId;
    if (!aid) {
      return stories.map((_, i) => i);
    }
    const out: number[] = [];
    for (let i = 0; i < stories.length; i += 1) {
      if ((stories[i]?.authorId ?? "") === aid) out.push(i);
    }
    return out.length > 0 ? out : stories.map((_, i) => i);
  }, [stories, currentStoryAuthorId]);

  const localProgressIndex = useMemo(() => {
    const pos = progressSegmentGlobalIndices.indexOf(currentIndex);
    return pos >= 0 ? pos : 0;
  }, [progressSegmentGlobalIndices, currentIndex]);

  useEffect(() => {
    setMediaStatus("loading");
    setMediaRetryKey(0);
    return () => {
      if (videoProgressRafRef.current != null) {
        cancelAnimationFrame(videoProgressRafRef.current);
        videoProgressRafRef.current = null;
      }
    };
  }, [currentStory?.id]);

  useEffect(() => {
    const aid = currentStoryAuthorId;
    if (prevAuthorIdRef.current !== null && prevAuthorIdRef.current !== aid && aid) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    prevAuthorIdRef.current = aid || null;
  }, [currentStoryAuthorId]);

  useEffect(() => {
    if (!navEdgeFlash) return;
    const t = window.setTimeout(() => setNavEdgeFlash(null), 140);
    return () => window.clearTimeout(t);
  }, [navEdgeFlash]);

  /** Родитель часто передаёт инлайн-колбэк → стабильная ссылка, иначе эффект дёргается на каждый ререндер ленты. */
  const onStoryViewRef = useRef(onStoryView);
  onStoryViewRef.current = onStoryView;
  /** Не более одного вызова на сториз за открытие просмотрщика (смена слайда = новый id). */
  const storyViewReportedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentStoryId || !onStoryViewRef.current) return;
    if (storyViewReportedRef.current.has(currentStoryId)) return;
    storyViewReportedRef.current.add(currentStoryId);
    onStoryViewRef.current(currentStoryId);
  }, [currentStoryId]);

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
    void fetchStoryViewersCached(currentStoryId)
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

  const rampVideoVolumeUp = useCallback(
    (v: HTMLVideoElement, target: number) => {
      volumeRampCancelRef.current?.();
      const startVol = 0;
      v.volume = startVol;
      const t0 = performance.now();
      let raf = 0;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / SOUND_FADE_IN_MS);
        const eased = t * t * (3 - 2 * t);
        v.volume = startVol + (target - startVol) * eased;
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          volumeRampCancelRef.current = null;
        }
      };
      volumeRampCancelRef.current = () => {
        cancelAnimationFrame(raf);
        volumeRampCancelRef.current = null;
      };
      raf = requestAnimationFrame(step);
    },
    []
  );

  const toggleStorySound = useCallback(
    (nextMuted?: boolean) => {
      const v = storyVideoRef.current;
      const muted = typeof nextMuted === "boolean" ? nextMuted : !storyVideoMuted;
      setStoryVideoMuted(muted);
      showSoundHud(muted);
      if (!v) return;
      if (muted) {
        volumeRampCancelRef.current?.();
        volumeRampCancelRef.current = null;
        if (v.volume > 0.02) setStoryVideoVolume(v.volume);
        v.muted = true;
      } else {
        const target = getStoryVideoVolume();
        v.muted = false;
        if (prefersReducedMotion) {
          v.volume = target;
        } else {
          rampVideoVolumeUp(v, target);
        }
      }
      void v.play().catch((err: unknown) => {
        if (isMediaPlayNotAllowedError(err)) {
          v.muted = true;
          setStoryVideoMuted(true);
          showSoundHud(true);
          void v.play().catch(() => {});
        }
      });
    },
    [showSoundHud, storyVideoMuted, prefersReducedMotion, rampVideoVolumeUp]
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
      v.volume = getStoryVideoVolume();
      v.muted = preferredMuted;
      const p = v.play();
      if (p && !preferredMuted) {
        p.catch((err: unknown) => {
          if (isMediaPlayNotAllowedError(err)) {
            v.muted = true;
            setStoryVideoMuted(true);
            void v.play().catch(() => {});
          }
        });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [currentStory?.id, isVideoStory]);

  useEffect(() => {
    const v = storyVideoRef.current;
    if (!v || !isVideoStory) return;
    if (runtimePaused) v.pause();
    else {
      // Не сбрасываем звук при сбое play() после паузы (раньше любой reject глушил видео).
      void v.play().catch(() => {});
    }
  }, [isVideoStory, runtimePaused, currentStory?.id]);

  /** Явный жест «другая сториз» — черновик ответа сбрасывается (передумал писать). */
  const discardReplyDraft = useCallback(() => {
    setReplyText("");
    setReplyBind(null);
    setReplyFocused(false);
    setReplyError(null);
    setActionError(null);
  }, []);

  const saveResumeAndClose = useCallback(() => {
    if (sessionResumeKey && stories.length > 0) {
      try {
        sessionStorage.setItem(`ping:story-resume:${sessionResumeKey}`, String(currentIndex));
      } catch {
        /* ignore */
      }
    }
    onStoryViewerAnalyticsRef.current?.({
      type: "closed",
      lastIndex: currentIndex,
      storyCount: stories.length,
      sessionMs: Date.now() - openTimeRef.current,
    });
    onClose?.();
  }, [sessionResumeKey, stories.length, currentIndex, onClose]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
      return;
    }
    saveResumeAndClose();
  }, [currentIndex, saveResumeAndClose, stories.length]);

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

  const requestClose = useCallback(() => {
    const hasDraft =
      replyText.trim().length > 0 &&
      replyBind !== null &&
      !!viewerUserId &&
      replyBind.authorId !== viewerUserId;
    if (hasDraft) {
      setCloseDragY(0);
      setCloseGestureActive(false);
      setReplyExitConfirmOpen(true);
      return;
    }
    saveResumeAndClose();
  }, [replyText, replyBind, viewerUserId, saveResumeAndClose]);

  const openAuthorProfile = useCallback(
    (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      const path = buildProfilePath({
        isMe: !!viewerUserId && currentStoryAuthorId === viewerUserId,
        userId: currentStoryAuthorId || undefined,
        fallbackPath: "/posts",
      });
      setLocation(path);
      saveResumeAndClose();
    },
    [currentStoryAuthorId, saveResumeAndClose, setLocation, viewerUserId]
  );

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

  const startHorizontalRebound = useCallback(
    (dragX: number) => {
      if (prefersReducedMotion) return;
      if (horizReboundRafRef.current != null) {
        cancelAnimationFrame(horizReboundRafRef.current);
        horizReboundRafRef.current = null;
      }
      const vw = typeof window !== "undefined" ? window.innerWidth || document.documentElement.clientWidth || 390 : 390;
      const from = computeStoryParallaxTx(dragX, vw, storyParallaxOpts);
      if (Math.abs(from) < 0.75) return;
      setHorizRebound({ value: from, sliding: false });
      horizReboundRafRef.current = requestAnimationFrame(() => {
        horizReboundRafRef.current = requestAnimationFrame(() => {
          horizReboundRafRef.current = null;
          setHorizRebound({ value: 0, sliding: true });
        });
      });
    },
    [prefersReducedMotion, storyParallaxOpts],
  );

  const applyProgressFromClientX = useCallback(
    (clientX: number) => {
      const row = progressRowRef.current;
      const segments = progressSegmentGlobalIndices;
      if (!row || segments.length === 0) return;
      const rect = row.getBoundingClientRect();
      const rowW = rect.width;
      if (rowW <= 0) return;
      let t = (clientX - rect.left) / rowW;
      t = Math.max(0, Math.min(1, t));
      const n = segments.length;
      const floatIdx = t * n;
      const localIdx = Math.min(n - 1, Math.max(0, Math.floor(floatIdx)));
      const within = n > 1 ? floatIdx - localIdx : floatIdx;
      const globalIdx = segments[localIdx]!;
      setCurrentIndex(globalIdx);
      const clamped = Math.max(0, Math.min(1, within));
      setProgress(clamped);
      const v = storyVideoRef.current;
      if (v && v.duration && Number.isFinite(v.duration) && v.duration > 0) {
        try {
          v.currentTime = Math.max(0, Math.min(v.duration - 0.04, clamped * v.duration));
        } catch {
          /* ignore */
        }
      }
    },
    [progressSegmentGlobalIndices],
  );

  const onProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (replyNavigationBlocked || progressSegmentGlobalIndices.length === 0) return;
      if (e.button !== 0) return;
      e.stopPropagation();
      progressScrubPointerRef.current = e.pointerId;
      setProgressScrubbing(true);
      setPaused(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      applyProgressFromClientX(e.clientX);
    },
    [applyProgressFromClientX, progressSegmentGlobalIndices.length, replyNavigationBlocked],
  );

  const onProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (progressScrubPointerRef.current !== e.pointerId) return;
      e.stopPropagation();
      applyProgressFromClientX(e.clientX);
    },
    [applyProgressFromClientX],
  );

  const endProgressScrubPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (progressScrubPointerRef.current !== e.pointerId) return;
    e.stopPropagation();
    progressScrubPointerRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    setProgressScrubbing(false);
    setPaused(false);
  }, []);

  const onProgressPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endProgressScrubPointer(e);
    },
    [endProgressScrubPointer],
  );

  const onMediaParallaxTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    setHorizRebound((prev) => (prev?.sliding && Math.abs(prev.value) < 0.25 ? null : prev));
  }, []);

  useEffect(() => {
    if (mediaStatus !== "ready" || !currentStoryId) return;
    if (firstFrameAnalyticsSentRef.current) return;
    firstFrameAnalyticsSentRef.current = true;
    onStoryViewerAnalyticsRef.current?.({
      type: "first_frame",
      storyId: currentStoryId,
      msSinceOpen: Date.now() - openTimeRef.current,
    });
  }, [mediaStatus, currentStoryId]);

  useEffect(() => {
    if (prevSlideIndexRef.current === null) {
      prevSlideIndexRef.current = currentIndex;
      return;
    }
    if (prevSlideIndexRef.current === currentIndex) return;
    const from = prevSlideIndexRef.current;
    prevSlideIndexRef.current = currentIndex;
    const sid = normalizeStorySlideId(stories[currentIndex]?.id);
    if (!sid) return;
    onStoryViewerAnalyticsRef.current?.({
      type: "slide_changed",
      fromIndex: from,
      toIndex: currentIndex,
      storyId: sid,
    });
  }, [currentIndex, stories]);

  useEffect(() => {
    const name = currentStory?.userName || "Автор";
    startTransition(() => {
      setA11ySlideStatus(
        `Сториз ${localProgressIndex + 1} из ${progressSegmentGlobalIndices.length}, ${name}`
      );
    });
  }, [
    currentStory?.userName,
    localProgressIndex,
    progressSegmentGlobalIndices.length,
    currentIndex,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (replyExitConfirmOpen) {
        e.preventDefault();
        setReplyExitConfirmOpen(false);
        return;
      }
      if (showActions) return;
      e.preventDefault();
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, replyExitConfirmOpen, showActions]);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      runtimePaused ||
      isVideoStory ||
      !stories.length ||
      replyNavigationBlocked ||
      mediaStatus !== "ready"
    )
      return;
    const interval = 100;
    const duration = photoStoryDurationMs;
    const step = interval / duration;
    const t = window.setInterval(() => {
      setProgress((p) => {
        if (p + step >= 1) {
          const ci = currentIndex;
          const next = ci + 1;
          if (next < stories.length && (stories[next]?.authorId ?? "") === (stories[ci]?.authorId ?? "")) {
            triggerTapFeedback({ haptic: true, sound: false });
          }
          safeGoNext();
          return 0;
        }
        return p + step;
      });
    }, interval);
    return () => window.clearInterval(t);
  }, [
    prefersReducedMotion,
    isVideoStory,
    runtimePaused,
    replyNavigationBlocked,
    safeGoNext,
    stories.length,
    currentIndex,
    mediaStatus,
    photoStoryDurationMs,
    stories,
  ]);

  const onStoryVideoTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (runtimePaused) return;
      const v = e.currentTarget;
      if (!v.duration || !Number.isFinite(v.duration) || v.duration <= 0) return;
      pendingVideoProgressRef.current = Math.min(1, v.currentTime / v.duration);
      if (videoProgressRafRef.current != null) return;
      videoProgressRafRef.current = requestAnimationFrame(() => {
        videoProgressRafRef.current = null;
        setProgress(pendingVideoProgressRef.current);
      });
    },
    [runtimePaused]
  );

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
    const ci = currentIndex;
    const next = ci + 1;
    if (next < stories.length && (stories[next]?.authorId ?? "") === (stories[ci]?.authorId ?? "")) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    safeGoNext();
  }, [replyNavigationBlocked, safeGoNext, currentIndex, stories]);

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
        toast({ title: "Сообщение отправлено", duration: STORY_REPLY_SENT_TOAST_MS });
        setReplyText("");
        setReplyBind(null);
      })
      .catch((err: unknown) => {
        triggerErrorFeedback();
        setReplyError(err instanceof Error ? err.message : "Failed to send reply");
      })
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
    if (dragFlushRafRef.current != null) {
      cancelAnimationFrame(dragFlushRafRef.current);
      dragFlushRafRef.current = null;
    }
    dragPendingRef.current = { dx: 0, hasDx: false, closeY: 0, hasClose: false };
    setCloseDragY(0);
    setCloseGestureActive(false);
    setDragVisual({ x: 0, active: false });
    setHorizRebound(null);
    if (horizReboundRafRef.current != null) {
      cancelAnimationFrame(horizReboundRafRef.current);
      horizReboundRafRef.current = null;
    }
    const nowPerf = performance.now();
    pointerStartRef.current = { x: e.clientX, y: e.clientY, at: Date.now(), atPerf: nowPerf };
    gestureTrackRef.current = { lastX: e.clientX, lastY: e.clientY, t: nowPerf };
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
    gestureTrackRef.current = {
      lastX: e.clientX,
      lastY: e.clientY,
      t: performance.now(),
    };
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (pointerIntentRef.current === "tap") {
      if (absX <= TAP_MOVE_MAX_PX && absY <= TAP_MOVE_MAX_PX) return;
      // Ближе к Instagram: вертикаль «вниз» чуть приоритетнее косых жестов; горизонталь ловим раньше.
      const verticalWins = absY > absX * 1.08 && absY > V_SWIPE_START_PX;
      const horizontalWins = absX > absY * 1.04 && absX > H_SWIPE_START_PX;
      if (verticalWins && !horizontalWins) {
        pointerIntentRef.current = "swipe-y";
        const pull = Math.max(0, dy) * CLOSE_DRAG_RESIST;
        setCloseGestureActive(true);
        setCloseDragY(Math.max(0, Math.min(140, pull)));
        return;
      }
      if (horizontalWins || (absX > H_SWIPE_START_PX && absX >= absY * 0.96)) {
        pointerIntentRef.current = "swipe-x";
        return;
      }
      pointerIntentRef.current = "none";
    }

    if (pointerIntentRef.current === "swipe-x") {
      dragPendingRef.current = {
        ...dragPendingRef.current,
        dx,
        hasDx: true,
      };
      schedulePointerDragFlush();
    }
    if (pointerIntentRef.current === "swipe-y") {
      const pull = Math.max(0, dy) * CLOSE_DRAG_RESIST;
      dragPendingRef.current = {
        ...dragPendingRef.current,
        closeY: Math.max(0, Math.min(140, pull)),
        hasClose: true,
      };
      schedulePointerDragFlush();
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

    try {
      if (!start) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const heldMs = Date.now() - start.at;
      const intent = pointerIntentRef.current;
      pointerIntentRef.current = "none";

      if (intent === "swipe-y") {
        setCloseGestureActive(false);
        const tr = gestureTrackRef.current;
        if (storyVerticalCloseShouldCommit(dy, absX, absY, e.clientY, tr.lastY, tr.t, performance.now())) {
          requestClose();
        } else {
          setCloseDragY(0);
        }
        return;
      }

      if (intent === "swipe-x") {
        if (absX < absY * 1.02) return;
        const tr = gestureTrackRef.current;
        if (
          !storyHorizontalShouldCommit(
            start.x,
            e.clientX,
            tr.lastX,
            tr.t,
            performance.now(),
            start.atPerf,
          )
        ) {
          startHorizontalRebound(dx);
          return;
        }
        void triggerTapFeedback({ haptic: true, sound: false });
        setHorizRebound(null);
        if (horizReboundRafRef.current != null) {
          cancelAnimationFrame(horizReboundRafRef.current);
          horizReboundRafRef.current = null;
        }
        // Как в Instagram: горизонтальный свайп — сначала другой аккаунт, иначе соседний слайд.
        if (dx < 0) {
          if (!safeGoNextAuthor()) safeGoNext();
        } else if (!safeGoPrevAuthor()) safeGoPrev();
        return;
      }

      // Жест распознан как «не свайп», но по факту горизонтальный — не теряем навигацию.
      if (intent === "none" || intent === "tap") {
        if (absX < absY * 1.04) return;
        const tr = gestureTrackRef.current;
        if (
          !storyHorizontalShouldCommit(
            start.x,
            e.clientX,
            tr.lastX,
            tr.t,
            performance.now(),
            start.atPerf,
          )
        ) {
          startHorizontalRebound(dx);
          return;
        }
        void triggerTapFeedback({ haptic: true, sound: false });
        setHorizRebound(null);
        if (horizReboundRafRef.current != null) {
          cancelAnimationFrame(horizReboundRafRef.current);
          horizReboundRafRef.current = null;
        }
        if (dx < 0) {
          if (!safeGoNextAuthor()) safeGoNext();
        } else if (!safeGoPrevAuthor()) safeGoPrev();
        return;
      }

      if (absX > TAP_MOVE_MAX_PX || absY > TAP_MOVE_MAX_PX) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const inEdgeTapZone = x <= rect.width * TAP_ZONE_THIRD || x >= rect.width * (1 - TAP_ZONE_THIRD);
      // Пауза удержанием не должна ломать «назад/вперёд» по краям (раньше heldMs > 220 гасило зоны).
      if (!inEdgeTapZone && heldMs > TAP_MAX_MS) return;

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
          if (!prefersReducedMotion) {
            setLikeBloom({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
            window.setTimeout(() => setLikeBloom(null), 420);
          }
        } else if (isVideoStory) {
          toggleStorySound();
        }
        lastTapRef.current = null;
        return;
      }

      lastTapRef.current = { at: now, x: e.clientX, y: e.clientY };
    if (x <= rect.width * TAP_ZONE_THIRD) {
      safeGoPrev();
      setNavEdgeFlash("left");
      return;
    }
    if (x >= rect.width * (1 - TAP_ZONE_THIRD)) {
      safeGoNext();
      setNavEdgeFlash("right");
    }
    } finally {
      if (dragFlushRafRef.current != null) {
        cancelAnimationFrame(dragFlushRafRef.current);
        dragFlushRafRef.current = null;
      }
      dragPendingRef.current = { dx: 0, hasDx: false, closeY: 0, hasClose: false };
      setDragVisual({ x: 0, active: false });
      setCloseGestureActive(false);
      setCloseDragY(0);
    }
  };

  const onMainPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    finishMainPointer(e);
  };

  const onMainPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const intent = pointerIntentRef.current;
    const hadHorizPull = dragPendingRef.current.hasDx;
    const bailDx = dragPendingRef.current.dx;
    if (dragFlushRafRef.current != null) {
      cancelAnimationFrame(dragFlushRafRef.current);
      dragFlushRafRef.current = null;
    }
    dragPendingRef.current = { dx: 0, hasDx: false, closeY: 0, hasClose: false };
    pointerStartRef.current = null;
    pointerIntentRef.current = "none";
    setPaused(false);
    setDragVisual({ x: 0, active: false });
    setCloseGestureActive(false);
    setCloseDragY(0);
    if ((intent === "swipe-x" || intent === "none") && hadHorizPull && Math.abs(bailDx) > 8) {
      startHorizontalRebound(bailDx);
    }
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

  const nextPeekSrc = storyPeekImageSrc(authorAwarePeek.nextPeek);
  const prevPeekSrc = storyPeekImageSrc(authorAwarePeek.prevPeek);
  const viewportW =
    typeof window !== "undefined" ? window.innerWidth || document.documentElement.clientWidth || 390 : 390;
  const peekStripW =
    dragVisual.active && !prefersReducedMotion
      ? computeStoryPeekStripWidth(Math.abs(dragVisual.x), viewportW)
      : 0;
  const mediaParallaxTx = dragVisual.active
    ? computeStoryParallaxTx(dragVisual.x, viewportW, storyParallaxOpts)
    : horizRebound !== null
      ? horizRebound.value
      : 0;
  const mediaParallaxTransition = (() => {
    if (dragVisual.active || closeGestureActive) return "none";
    if (horizRebound?.sliding) {
      return prefersReducedMotion
        ? `transform ${DURATION_FAST_MS}ms ${EASING_OUT}`
        : `transform ${STORY_H_REBOUND_MS}ms cubic-bezier(0.2, 0.82, 0.22, 1)`;
    }
    if (horizRebound && !horizRebound.sliding) return "none";
    return `transform ${DURATION_NORMAL_MS}ms ${EASING_OUT}`;
  })();

  if (!stories.length || !currentStory) return null;

  const viewerNode = (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр сториз"
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
      className={cn(
        "story-viewer-root fixed inset-0 z-[320] flex uix-responsive-max-w flex-col overflow-hidden overscroll-none bg-black text-white touch-manipulation",
        "h-[100svh] min-h-0 max-h-[100svh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]"
      )}
      style={{
        fontFamily: "'Inter','SF Pro Display',system-ui,sans-serif",
      }}
    >
      <div
        className="absolute inset-0 flex flex-col overflow-hidden"
        style={{
          transform: `translateY(${closeDragY}px) scale(${Math.max(0.93, 1 - closeDragY / 580)})`,
          opacity: Math.max(0.32, 1 - closeDragY / 420),
          transition: closeGestureActive
            ? "none"
            : prefersReducedMotion
              ? `transform ${DURATION_NORMAL_MS}ms ${EASING_OUT}, opacity ${DURATION_NORMAL_MS}ms ${EASING_OUT}`
              : `transform ${STORY_H_REBOUND_MS}ms cubic-bezier(0.2, 0.82, 0.22, 1), opacity ${STORY_H_REBOUND_MS}ms ${EASING_OUT}`,
          willChange: closeGestureActive ? "transform, opacity" : "auto",
        }}
      >
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {a11ySlideStatus}
        </span>

      <div
        className="absolute inset-0 z-[1] overflow-hidden bg-black"
        style={{ contain: "strict" }}
      >
        {peekStripW > 10 && dragVisual.x < 0 && authorAwarePeek.nextPeek && !prefersReducedMotion ? (
          <div
            className="absolute inset-y-0 right-0 z-0 overflow-hidden bg-zinc-950 ring-1 ring-inset ring-white/10 supports-[backdrop-filter]:backdrop-blur-[2px]"
            style={{ width: peekStripW }}
            aria-hidden
          >
            {nextPeekSrc ? (
              <img
                src={nextPeekSrc}
                alt=""
                className="h-full w-full object-cover opacity-[0.9]"
                draggable={false}
                decoding="async"
                fetchPriority="low"
                loading="lazy"
              />
            ) : null}
          </div>
        ) : null}
        {peekStripW > 10 && dragVisual.x > 0 && authorAwarePeek.prevPeek && !prefersReducedMotion ? (
          <div
            className="absolute inset-y-0 left-0 z-0 overflow-hidden bg-zinc-950 ring-1 ring-inset ring-white/10 supports-[backdrop-filter]:backdrop-blur-[2px]"
            style={{ width: peekStripW }}
            aria-hidden
          >
            {prevPeekSrc ? (
              <img
                src={prevPeekSrc}
                alt=""
                className="h-full w-full object-cover opacity-[0.9]"
                draggable={false}
                decoding="async"
                fetchPriority="low"
                loading="lazy"
              />
            ) : null}
          </div>
        ) : null}

        <div
          className="absolute inset-0 z-[1]"
          onPointerDown={onMainPointerDown}
          onPointerMove={onMainPointerMove}
          onPointerUp={onMainPointerUp}
          onPointerCancel={onMainPointerCancel}
          onTransitionEnd={onMediaParallaxTransitionEnd}
          style={{
            touchAction: "none",
            transform: `translateX(${mediaParallaxTx}px)`,
            transition: mediaParallaxTransition,
            willChange: dragVisual.active || closeGestureActive || horizRebound?.sliding ? "transform" : "auto",
          }}
        >
          <AnimatePresence mode="wait" initial={false} custom={navDir}>
            <motion.div
              key={`${normalizeStorySlideId(currentStory.id) ?? "story"}-${mediaRetryKey}`}
              className="absolute inset-0"
              custom={navDir}
              variants={{
                enter: (dir: number) =>
                  prefersReducedMotion
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: dir > 0 ? 32 : dir < 0 ? -32 : 14 },
                center: { opacity: 1, x: 0 },
                exit: (dir: number) =>
                  prefersReducedMotion
                    ? { opacity: 0, x: 0 }
                    : { opacity: 0, x: dir > 0 ? -26 : dir < 0 ? 26 : -14 },
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: prefersReducedMotion ? 0.09 : 0.24, ease: EASING_OUT_BEZIER }}
            >
              {isVideoStory ? (
                <video
                  ref={storyVideoRef}
                  src={currentStory.image}
                  className="h-full w-full object-cover"
                  playsInline
                  disableRemotePlayback
                  muted={storyVideoMuted}
                  autoPlay
                  preload="auto"
                  onLoadedData={() => setMediaStatus("ready")}
                  onCanPlay={() => setMediaStatus("ready")}
                  onError={() => setMediaStatus("error")}
                  onTimeUpdate={onStoryVideoTimeUpdate}
                  onEnded={onStoryVideoEnded}
                />
              ) : (
                <img
                  src={currentStory.image}
                  alt={currentStory.userName || "Story"}
                  className="h-full w-full object-cover"
                  decoding="async"
                  fetchPriority="high"
                  loading="eager"
                  sizes="100vw"
                  onLoad={() => setMediaStatus("ready")}
                  onError={() => setMediaStatus("error")}
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {mediaStatus === "loading" ? (
            <div className="pointer-events-none absolute inset-0 z-[4] bg-black">
              <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-white/[0.08]" />
            </div>
          ) : null}
          {mediaStatus === "error" ? (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-black/85 px-6">
              <p className="text-center text-sm text-white/85">Не удалось загрузить сториз</p>
              <button
                type="button"
                className="min-h-[var(--uix-touch-min)] rounded-full bg-white/15 px-5 py-2 text-sm font-semibold text-white backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setMediaStatus("loading");
                  setMediaRetryKey((k) => k + 1);
                }}
              >
                Повторить
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 24%, transparent 62%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {navEdgeFlash ? (
        <div
          className={cn(
            "story-sv-anim-edge-nav pointer-events-none absolute inset-y-0 z-[19]",
            navEdgeFlash === "left" ? "left-0" : "right-0"
          )}
          style={
            navEdgeFlash === "left"
              ? {
                  width: `${100 * TAP_ZONE_THIRD}%`,
                  background: "linear-gradient(90deg, rgba(255,255,255,0.16) 0%, transparent 100%)",
                }
              : {
                  width: `${100 * TAP_ZONE_THIRD}%`,
                  background: "linear-gradient(270deg, rgba(255,255,255,0.16) 0%, transparent 100%)",
                }
          }
          aria-hidden
        />
      ) : null}

      {likeBloom ? (
        <div
          className="story-sv-anim-bloom pointer-events-none absolute z-[54]"
          style={{
            left: likeBloom.x,
            top: likeBloom.y,
            width: 220,
            height: 220,
            transform: "translate(-50%, -50%)",
            background:
              "radial-gradient(circle, rgba(251,113,133,0.48) 0%, rgba(251,113,133,0.1) 45%, transparent 70%)",
          }}
          aria-hidden
        />
      ) : null}

      {doubleTapHeart ? (
        <div
          className="story-sv-anim-heart-big pointer-events-none absolute left-1/2 top-[42%] z-[55]"
          style={{
            fontSize: 88,
            lineHeight: 1,
            filter: "drop-shadow(0 4px 16px rgba(251,113,133,0.6))",
          }}
        >
          ❤️
        </div>
      ) : null}

      {soundHudVisible && isVideoStory ? (
        <div
          className={cn(
            "pointer-events-none absolute left-1/2 top-[44%] z-[56] -translate-x-1/2 rounded-full bg-black/55 px-4 py-2",
            !prefersReducedMotion && "backdrop-blur-md"
          )}
        >
          <span className="text-xs font-semibold text-white/90">
            {soundHudIsMuted ? "Без звука" : "Звук вкл."}
          </span>
        </div>
      ) : null}

      <div className="uix-fullscreen-overlay-x absolute left-0 right-0 top-0 z-[20] pt-[max(8px,calc(0.5rem+env(safe-area-inset-top,0px)))]">
        <div
          ref={progressRowRef}
          className={cn(
            "pointer-events-auto mb-2.5 flex min-h-[var(--uix-touch-min)] cursor-grab touch-none items-center gap-1 px-0.5 py-2 -my-2 active:cursor-grabbing",
            runtimePaused && "opacity-90",
            replyNavigationBlocked && "pointer-events-none opacity-60",
          )}
          onPointerDown={onProgressPointerDown}
          onPointerMove={onProgressPointerMove}
          onPointerUp={onProgressPointerUp}
          onPointerCancel={onProgressPointerUp}
          role="slider"
          aria-label="Прогресс сториз текущего автора"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, progressSegmentGlobalIndices.length - 1)}
          aria-valuenow={localProgressIndex}
        >
          {progressSegmentGlobalIndices.map((globalIdx, localIdx) => {
            const s = stories[globalIdx];
            const fill =
              localIdx < localProgressIndex ? 1 : localIdx === localProgressIndex ? progress : 0;
            return (
              <div
                key={normalizeStorySlideId(s?.id) ?? globalIdx}
                className="h-[3px] min-h-[3px] flex-1 overflow-hidden rounded-full bg-white/22"
              >
                <div
                  className="h-full rounded-full bg-white"
                  style={{
                    width: `${Math.max(0, Math.min(1, fill)) * 100}%`,
                    transition:
                      progressScrubbing || globalIdx === currentIndex
                        ? "none"
                        : "width 0.24s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStoryAuthorId || String(currentIndex)}
              initial={prefersReducedMotion ? false : { opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 4 }}
              transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
              className="flex min-w-0 flex-1 items-center gap-2.5"
            >
              <button
                type="button"
                onClick={openAuthorProfile}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left min-h-[var(--uix-touch-min)]"
                aria-label={`Открыть профиль: ${currentStory.userName || "пользователь"}`}
              >
                {isOwnCurrentStory ? (
                  <UserAvatar
                    avatarUrl={currentStory.userAvatar?.trim() ? currentStory.userAvatar : undefined}
                    displayName={currentStory.userName}
                    seed={currentStory.authorId ?? currentStory.userName}
                    size={36}
                    className="h-9 w-9 shrink-0 rounded-full border-2 border-white/85"
                  />
                ) : (
                  <div className="shrink-0 rounded-full p-[2.5px]" style={{ background: PULSE_IG_GRAD }} aria-hidden>
                    <UserAvatar
                      avatarUrl={currentStory.userAvatar?.trim() ? currentStory.userAvatar : undefined}
                      displayName={currentStory.userName}
                      seed={currentStory.authorId ?? currentStory.userName}
                      size={36}
                      className="h-9 w-9 rounded-full border-2 border-black"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-white">
                      {currentStory.userName || "Unknown"}
                    </span>
                    <span className="shrink-0 text-[13px] text-white/75">{currentStory.time || ""}</span>
                  </div>
                </div>
              </button>
            </motion.div>
          </AnimatePresence>

          {isVideoStory ? (
            <button
              type="button"
              aria-label={storyVideoMuted ? "Unmute story" : "Mute story"}
              aria-pressed={!storyVideoMuted}
              title={storyVideoMuted ? "Звук выключен" : "Звук включён"}
              onClick={(e) => {
                e.stopPropagation();
                toggleStorySound();
              }}
              className={cn(
                "uix-overlay-icon-hit flex items-center justify-center rounded-full text-white/90",
                storyVideoMuted ? "bg-black/45" : "bg-emerald-500/22"
              )}
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
            className="uix-overlay-icon-hit flex items-center justify-center rounded-full bg-black/30 text-white/90"
          >
            <MoreHorizontal size={17} />
          </button>
          <button
            type="button"
            aria-label="Закрыть сториз"
            onClick={(e) => {
              e.stopPropagation();
              requestClose();
            }}
            className="uix-overlay-icon-hit flex items-center justify-center rounded-full bg-black/30 text-white/90"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="uix-fullscreen-overlay-x absolute bottom-0 left-0 right-0 z-[24] flex flex-col gap-2 pb-[max(14px,calc(env(safe-area-inset-bottom,0px)+14px))]">
        {currentStory.caption?.trim() ? (
          <p
            className="pointer-events-none px-3 text-center text-sm leading-snug text-white [text-shadow:0_1px_10px_rgba(0,0,0,0.9)] line-clamp-4"
            aria-hidden
          >
            {currentStory.caption.trim()}
          </p>
        ) : null}
        {isOwnCurrentStory ? (
          <div
            onClick={openViewersSheet}
            className="flex min-h-[var(--uix-touch-min)] cursor-pointer items-center gap-3 rounded-[26px] border border-white/15 bg-black/35 px-4 py-3 backdrop-blur-xl"
          >
            <div className="flex items-center">
              {viewerPreviewLoading ? (
                <div className="h-6 w-16 rounded-full bg-white/15" />
              ) : viewerPreview.length ? (
                viewerPreview.map((v, i) => {
                  const vn = [v.displayName, v.surname].filter(Boolean).join(" ").trim() || `ID ${v.publicId}`;
                  return (
                    <UserAvatar
                      key={`${v.id}-${i}`}
                      avatarUrl={v.avatarUrl ?? undefined}
                      displayName={vn}
                      seed={v.id}
                      size={24}
                      className={cn("h-6 w-6 rounded-full border border-black/60", i > 0 ? "-ml-2" : "")}
                    />
                  );
                })
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
                <span className="text-xs font-medium">Кто смотрел</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-col gap-1 rounded-[26px] border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-xl">
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
              className={cn(
                "flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-55",
                likePulse && !prefersReducedMotion && "story-sv-anim-heart-pop"
              )}
            >
              <Heart size={20} color={isLiked ? "#fb7185" : "white"} fill={isLiked ? "#fb7185" : "none"} />
            </button>

            {(replyBind ? canReplyToBind : canReplyCurrentStory) &&
            (replyText.trim().length > 0 || sendingReply) ? (
              <button
                type="button"
                aria-label="Отправить ответ"
                onClick={(e) => {
                  e.stopPropagation();
                  submitStoryReply();
                }}
                disabled={sendingReply || !replyText.trim()}
                className={cn(
                  "flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full border backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-55",
                  replyText.trim() && !sendingReply
                    ? "border-indigo-400/50 bg-indigo-500 text-white"
                    : "border-white/20 bg-white/10 text-white/70"
                )}
              >
                <Send size={18} className={replyText.trim() && !sendingReply ? "text-white" : "text-white/80"} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Share story"
                onClick={(e) => {
                  e.stopPropagation();
                  runShare(false);
                }}
                disabled={!onShareStory || actionsBusy}
                className="flex h-11 w-11 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Share2 size={18} color="white" />
              </button>
            )}
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
      </div>

      {replyExitConfirmOpen ? (
        <div
          className="absolute inset-0 z-[370] flex items-center justify-center bg-black/75 px-4"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="sv-reply-exit-title"
          aria-describedby="sv-reply-exit-desc"
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#16131f] p-5 text-left shadow-2xl">
            <h2 id="sv-reply-exit-title" className="text-base font-bold text-white">
              Отменить ответ?
            </h2>
            <p id="sv-reply-exit-desc" className="mt-2 text-sm text-white/70">
              Черновик сообщения будет удалён.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                className="min-h-[var(--uix-touch-min)] rounded-full px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                onClick={() => setReplyExitConfirmOpen(false)}
              >
                Продолжить ответ
              </button>
              <button
                type="button"
                className="min-h-[var(--uix-touch-min)] rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
                onClick={() => {
                  setReplyExitConfirmOpen(false);
                  discardReplyDraft();
                  saveResumeAndClose();
                }}
              >
                Выйти без отправки
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        showReport={!isOwnCurrentStory && !!currentStoryId}
        onReport={() => setReportStoryOpen(true)}
        reportLabel={block01ugcRu.storySheetReport}
      />

      <ReportContentDialog
        open={reportStoryOpen}
        onOpenChange={setReportStoryOpen}
        target={
          currentStoryId ? { targetType: "story", targetId: currentStoryId } : null
        }
        contextLine={
          currentStory?.userName ? `Сториз: ${currentStory.userName}` : undefined
        }
      />
    </motion.div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(viewerNode, document.body);
}
