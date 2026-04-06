import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, MoreHorizontal, Pin, X } from "lucide-react";
import { resolveUrl } from "@/lib/api-base";
import type { ProfilePinItemRow } from "@/lib/profile-pins";
import { Button } from "@/components/ui/button";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const SWIPE_COMMIT_PX = 56;

export function ProfilePinFolderViewer({
  open,
  onClose,
  folderId,
  folderTitle,
  items,
  loading,
  loadError,
  onRetryLoad,
  isMe,
  onOpenManage,
  onOpenPinnedPost,
  onOpenPinnedStory,
}: {
  open: boolean;
  onClose: () => void;
  folderId: string;
  folderTitle: string;
  items: ProfilePinItemRow[];
  loading: boolean;
  loadError: boolean;
  onRetryLoad: () => void;
  isMe: boolean;
  onOpenManage: () => void;
  onOpenPinnedPost: (postId: string) => void;
  onOpenPinnedStory: (storyId: string) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [slideIndex, setSlideIndex] = useState(0);
  const dragRef = useRef<{ x: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setSlideIndex(0);
  }, [folderId, items.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const n = items.length;
  const safeIndex = n > 0 ? Math.min(slideIndex, n - 1) : 0;
  const current = n > 0 ? items[safeIndex] : null;

  const goPrev = useCallback(() => {
    setSlideIndex((i) => (n <= 0 ? 0 : i <= 0 ? n - 1 : i - 1));
  }, [n]);

  const goNext = useCallback(() => {
    setSlideIndex((i) => (n <= 0 ? 0 : i >= n - 1 ? 0 : i + 1));
  }, [n]);

  const onPointerDownSwipe = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { x: e.clientX };
  };

  const onPointerUpSwipe = (e: React.PointerEvent) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start) return;
    const d = e.clientX - start.x;
    if (d < -SWIPE_COMMIT_PX) goNext();
    else if (d > SWIPE_COMMIT_PX) goPrev();
  };

  const onPointerCancelSwipe = () => {
    dragRef.current = null;
  };

  const openPost = (id: string) => {
    onClose();
    onOpenPinnedPost(id);
  };

  const openStory = (id: string) => {
    onClose();
    onOpenPinnedStory(id);
  };

  if (!mounted || !open) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="pin-folder-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={folderTitle}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.12 : DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
          className="fixed inset-0 z-[321] flex flex-col bg-[#070708] text-white touch-manipulation overscroll-none"
        >
          <header className="z-20 flex shrink-0 items-center gap-2 uix-fullscreen-overlay-x pt-[max(8px,env(safe-area-inset-top))] pb-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 text-white hover:bg-white/10"
              aria-label="Закрыть"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <Pin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <h2 className="truncate text-sm font-semibold tracking-tight">{folderTitle}</h2>
              </div>
              {!loading && !loadError && n > 0 ? (
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/45">
                  {safeIndex + 1} / {n}
                </p>
              ) : null}
            </div>
            {isMe ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 text-white hover:bg-white/10"
                aria-label="Управление папкой"
                onClick={() => {
                  onOpenManage();
                }}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-11 shrink-0" aria-hidden />
            )}
          </header>

          <div className="relative min-h-0 flex-1">
            {loadError ? (
              <div className="flex h-full items-center justify-center px-4">
                <ErrorWithRetry onRetry={onRetryLoad} title="Не удалось загрузить" description="Проверьте сеть и попробуйте снова." />
              </div>
            ) : loading ? (
              <div className="flex h-full flex-col gap-3 p-4">
                <Skeleton className="h-full w-full max-w-md mx-auto rounded-2xl opacity-40" />
                <Skeleton className="mx-auto h-4 w-24 rounded opacity-30" />
              </div>
            ) : n === 0 ? (
              <div className="flex h-full items-center justify-center px-2">
                <ListEmptyState
                  icon={Pin}
                  title="Папка пуста"
                  description="Сюда можно добавить посты, сториз или файлы с устройства."
                  className="border-none bg-transparent text-white/90 [&_.text-muted-foreground]:text-white/55"
                />
              </div>
            ) : current ? (
              <div className="relative flex h-full w-full flex-col">
                <div
                  className="relative min-h-0 flex-1 overflow-hidden rounded-none bg-black/40 md:mx-auto md:max-w-lg md:rounded-2xl"
                  onPointerDown={onPointerDownSwipe}
                  onPointerUp={onPointerUpSwipe}
                  onPointerCancel={onPointerCancelSwipe}
                  onPointerLeave={onPointerCancelSwipe}
                >
                  {current.kind === "media" && current.previewUrl ? (
                    current.isVideo ? (
                      <video
                        key={current.id}
                        src={resolveUrl(current.previewUrl)}
                        className="h-full w-full object-contain"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={resolveUrl(current.previewUrl)}
                        alt=""
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    )
                  ) : current.previewUrl ? (
                    <div className="relative h-full w-full">
                      {current.isVideo ? (
                        <video
                          key={current.id}
                          src={resolveUrl(current.previewUrl)}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={resolveUrl(current.previewUrl)}
                          alt=""
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                      <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                        <p className="text-center text-xs text-white/80">
                          {current.kind === "post" ? "Пост" : "Сториз"}
                          {current.text?.trim() ? ` · ${current.text.trim().slice(0, 160)}` : ""}
                        </p>
                        <Button
                          type="button"
                          className="mx-auto min-h-[var(--uix-touch-min)] gap-2 rounded-full bg-white text-black hover:bg-white/90"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            current.kind === "post"
                              ? openPost(current.refId)
                              : openStory(current.refId)
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                          {current.kind === "post" ? "Открыть пост" : "Открыть сториз"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                      <p className="text-center text-sm text-white/70">
                        {current.kind === "post" ? "Пост" : current.kind === "story" ? "Сториз" : "Файл"}
                      </p>
                      {current.kind === "post" || current.kind === "story" ? (
                        <Button
                          type="button"
                          className="min-h-[var(--uix-touch-min)] gap-2 rounded-full bg-white text-black hover:bg-white/90"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() =>
                            current.kind === "post" ? openPost(current.refId) : openStory(current.refId)
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                          {current.kind === "post" ? "Открыть пост" : "Открыть сториз"}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    "flex shrink-0 items-center justify-between gap-2 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))]",
                    "border-t border-white/8 bg-[#070708]/95",
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] text-white hover:bg-white/10"
                    aria-label="Предыдущий"
                    onClick={goPrev}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <div className="flex flex-1 justify-center gap-1.5 overflow-x-auto px-1 hide-scrollbar">
                    {items.map((it, i) => (
                      <button
                        key={it.id}
                        type="button"
                        aria-label={`Слайд ${i + 1}`}
                        aria-current={i === safeIndex}
                        className={cn(
                          "h-1.5 shrink-0 rounded-full transition-all duration-200",
                          i === safeIndex ? "w-6 bg-white/90" : "w-1.5 bg-white/28",
                        )}
                        onClick={() => setSlideIndex(i)}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] text-white hover:bg-white/10"
                    aria-label="Следующий"
                    onClick={goNext}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
