import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, MoreHorizontal, Heart, Send, Eye, ChevronLeft, ChevronRight, Share2, Archive, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { fetchStoryViewers, type StoryViewerUser } from "@/lib/stories";
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

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeCommittedRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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
    if (!canSeeViewers || !isOwnCurrentStory || !currentStoryId) {
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
  }, [canSeeViewers, isOwnCurrentStory, currentStoryId]);

  useEffect(() => {
    if (isPaused) return;

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
  }, [currentIndex, stories.length, onClose, isPaused]);

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
      const rect = e.currentTarget.getBoundingClientRect();
      const x = clientX - rect.left;
      if (x < rect.width / 3) goPrev();
      else goNext();
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
        "fixed inset-0 z-[320] mx-auto flex w-full max-w-[480px] flex-col overflow-hidden overscroll-none bg-black text-white touch-manipulation",
        /* iOS Safari / старые WebView: запас до 100dvh; Android Chrome + веб: dvh */
        "h-[100svh] min-h-0 max-h-[100svh] supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]"
      )}
    >
      {/* Progress */}
      <div className="absolute top-0 inset-x-0 px-2 pt-[calc(env(safe-area-inset-top,0px)+8px)] flex gap-1 z-[62]">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-0.5 flex-1 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-75 ease-linear"
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
      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top,0px)+44px)] z-[60] px-3 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/35 to-transparent pb-10 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src={currentStory.userAvatar}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full border border-white/25 object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight shadow-sm">{currentStory.userName}</p>
            <p className="text-[12px] text-white/65">{currentStory.time}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 text-white hover:bg-white/15 active:bg-white/25"
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
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 text-white hover:bg-white/15 active:bg-white/25"
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
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ x: dragX }}
          transition={{ type: "spring", stiffness: 520, damping: 38 }}
        >
          <AnimatePresence mode="wait">
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
          </AnimatePresence>
        </motion.div>

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
              className="pointer-events-none absolute bottom-[28%] inset-x-0 z-10 text-center text-[12px] font-medium text-white/80 drop-shadow-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
            >
              Свайп влево — следующая история
            </motion.p>
          </>
        )}
      </div>

      {/* Низ: просмотры слева (автор), поле ответа, лайк, отправка */}
      <div className="absolute bottom-0 inset-x-0 z-[60] flex flex-col gap-2 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pt-6 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+10px))]">
        {canSeeViewers && isOwnCurrentStory && currentStoryId && (
          <button
            type="button"
            onClick={openViewersSheet}
            className="flex max-w-full min-h-[var(--uix-touch-min)] items-center gap-2 self-start rounded-2xl border border-white/15 bg-black/45 py-1.5 pl-1.5 pr-3 backdrop-blur-md transition-colors hover:bg-black/55 active:bg-black/65"
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

        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              enterKeyHint="send"
              inputMode="text"
              autoComplete="off"
              autoCorrect="on"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder={canReplyCurrentStory ? "Сообщение…" : "Ответы недоступны"}
              disabled={!canReplyCurrentStory || sendingReply}
              className={cn(
                /* text-base (16px): iOS Safari не зумит поле при фокусе, если в viewport не запрещён зум полностью */
                "min-h-[var(--uix-touch-min)] w-full rounded-2xl border border-white/20 bg-white/12 py-3 pl-4 pr-4 text-base text-white shadow-inner outline-none transition-[border,background]",
                "placeholder:text-white/45 focus:border-white/35 focus:bg-white/18",
                (!canReplyCurrentStory || sendingReply) && "opacity-55"
              )}
              onClick={(e) => e.stopPropagation()}
              aria-label="Ответ на сториз"
            />
            {replyError && (
              <p className="absolute left-1 top-full mt-1 text-[11px] text-red-300">{replyError}</p>
            )}
          </div>

          <TapScaleButton
            type="button"
            haptic
            subtle
            disabled={!canLikeCurrentStory}
            className={cn(
              "relative flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]",
              canLikeCurrentStory
                ? isLiked
                  ? "border-rose-400/50 bg-rose-500/25 text-rose-100 active:bg-rose-500/35"
                  : "border-white/20 bg-white/10 text-white hover:bg-white/18 active:bg-white/25"
                : "cursor-not-allowed border-white/10 bg-white/5 text-white/40"
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
              initial={prefersReducedMotion ? false : { scale: 0.82 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <Heart
                className={cn("h-7 w-7", isLiked ? "fill-rose-400 text-rose-400" : "text-white")}
                strokeWidth={2}
              />
            </motion.span>
            {likesCount > 0 && <span className="text-[10px] font-bold leading-none text-white/90">{likesCount}</span>}
          </TapScaleButton>

          <TapScaleButton
            type="button"
            haptic
            subtle
            disabled={!canReplyCurrentStory || sendingReply || !replyText.trim()}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl border px-3 py-2 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]",
              !canReplyCurrentStory || sendingReply || !replyText.trim()
                ? "border-white/10 bg-white/5 text-white/35"
                : "border-sky-400/40 bg-sky-500/25 text-sky-50 hover:bg-sky-500/35 active:bg-sky-500/45"
            )}
            onClick={(e) => {
              void handleReplySend(e);
            }}
            aria-label="Отправить ответ"
          >
            <Send className="h-6 w-6" />
          </TapScaleButton>
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
            {canManage && currentStoryId && onArchiveStory && (
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
            {canManage && currentStoryId && onDeleteStory && (
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
