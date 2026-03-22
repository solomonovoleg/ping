import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { X, Send, Heart, MessageCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { fetchComments, createComment, deleteComment, formatCommentTime, type CommentItem } from "@/lib/comments";
import { recordPostView } from "@/lib/posts";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { triggerSuccessFeedback } from "@/lib/micro-feedback";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { usePrefersReducedMotion, DURATION_NORMAL_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { ListEmptyState } from "@/components/ui/empty";

import avatarMain from "@/assets/images/avatar-main.png";

const OVERLAY_TRANSITION = { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER };
const PANEL_TRANSITION = { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER };

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number | string | null;
  /** Для инвалидации кеша постов автора и права автора удалять чужие комментарии в своём посте */
  postAuthorId?: string | null;
}

export default function CommentsModal({ isOpen, onClose, postId, postAuthorId }: CommentsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bumpPostQueries = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    if (postAuthorId) void queryClient.invalidateQueries({ queryKey: ["posts", "author", postAuthorId] });
    if (postId != null) void queryClient.invalidateQueries({ queryKey: ["post", String(postId)] });
  }, [postAuthorId, postId, queryClient]);

  useEffect(() => {
    if (!isOpen || postId == null) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    recordPostView(String(postId)).catch(() => {});
    fetchComments(postId)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить комментарии");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, postId]);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = async () => {
    const text = newComment.trim();
    if (!text || postId == null) return;
    if (!user) {
      setError("Войдите, чтобы оставить комментарий");
      return;
    }
    triggerLightHaptic();
    setSending(true);
    setError(null);
    try {
      const created = await createComment(postId, text);
      if (created) {
        setComments((prev) => [created, ...prev]);
        setNewComment("");
        triggerSuccessFeedback();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить комментарий");
    } finally {
      setSending(false);
    }
  };

  const canDeleteComment = (c: CommentItem) =>
    !!user?.id && (c.userId === user.id || (!!postAuthorId && postAuthorId === user.id));

  const handleDeleteComment = async (commentId: string) => {
    if (postId == null || !user) return;
    if (!window.confirm("Удалить этот комментарий?")) return;
    setDeletingId(commentId);
    setError(null);
    try {
      await deleteComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      bumpPostQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить комментарий");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleLike = (id: string) => {
    triggerSuccessFeedback();
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reducedMotion = usePrefersReducedMotion();
  const overlayVariants = reducedMotion
    ? { initial: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const panelVariants = reducedMotion
    ? { initial: { y: 0 }, exit: { opacity: 0 } }
    : { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } };

  const displayComments = comments.map((c) => ({
    ...c,
    time: formatCommentTime(c.createdAt),
    avatar: c.avatar || avatarMain,
    isLiked: likedIds.has(c.id),
    likes: likedIds.has(c.id) ? (c.likes || 0) + 1 : c.likes || 0,
  }));

  const modalNode = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="comments-overlay"
            className="fixed inset-0 w-full bg-black/40 z-[300] backdrop-blur-sm"
            initial={overlayVariants.initial}
            animate={"animate" in overlayVariants ? overlayVariants.animate : undefined}
            exit={overlayVariants.exit}
            transition={OVERLAY_TRANSITION}
            onClick={() => onClose?.()}
          />
          <motion.div
            ref={panelRef}
            key="comments-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comments-modal-title"
            className="fixed bottom-0 left-0 right-0 w-full max-w-[480px] mx-auto z-[301] bg-background rounded-t-3xl flex flex-col shadow-2xl max-h-[86dvh] min-h-[46dvh] h-[76dvh] pt-[env(safe-area-inset-top,0px)]"
            initial={panelVariants.initial}
            animate={"animate" in panelVariants ? panelVariants.animate : undefined}
            exit={panelVariants.exit}
            transition={PANEL_TRANSITION}
          >
            <div className="w-full flex justify-center pt-3 pb-1 sm:hidden shrink-0">
              <div className="w-12 h-1.5 bg-border rounded-full" />
            </div>

            <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center shrink-0">
              <h2 id="comments-modal-title" className="font-bold text-lg">
                Комментарии{" "}
                <span className="text-muted-foreground font-normal text-sm ml-1">{comments.length}</span>
              </h2>
              <TapScaleButton
                ref={closeButtonRef}
                type="button"
                onClick={() => onClose?.()}
                haptic
                className="p-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </TapScaleButton>
            </div>

            {error && (
              <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    if (postId != null) {
                      setLoading(true);
                      fetchComments(postId)
                        .then((list) => setComments(list))
                        .catch((e) =>
                          setError(e instanceof Error ? e.message : "Не удалось загрузить комментарии"),
                        )
                        .finally(() => setLoading(false));
                    }
                  }}
                  className="text-[13px] font-medium underline underline-offset-2 hover:no-underline"
                >
                  Повторить
                </button>
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
              {loading ? (
                <LoadingProgress loading minHeight="160px" className="rounded-lg flex-1 min-h-[160px]">
                  <div className="min-h-[160px]" />
                </LoadingProgress>
              ) : displayComments.length === 0 ? (
                <ListEmptyState
                  icon={MessageCircle}
                  title="Пока нет комментариев"
                  description="Оставьте первый комментарий прямо сейчас"
                  actionLabel={user ? "Написать комментарий" : undefined}
                  onAction={user ? () => inputRef.current?.focus() : undefined}
                  className="py-8"
                />
              ) : (
                displayComments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <img
                      src={comment.avatar}
                      alt={comment.user}
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-[14px]">{comment.user}</span>
                        <span className="text-muted-foreground text-xs">{comment.time}</span>
                      </div>
                      <p className="text-[14px] leading-relaxed mb-1">{comment.text}</p>
                      <button
                        type="button"
                        className="text-muted-foreground text-xs font-medium hover:text-foreground min-h-[var(--uix-touch-min)] py-1 -mb-1"
                        aria-label={`Ответить на комментарий ${comment.user}`}
                      >
                        Ответить
                      </button>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                      {canDeleteComment(comment) ? (
                        <TapScaleButton
                          type="button"
                          onClick={() => void handleDeleteComment(comment.id)}
                          haptic
                          disabled={deletingId === comment.id}
                          className="p-1.5 rounded-full hover:bg-destructive/15 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center text-muted-foreground hover:text-destructive"
                          aria-label="Удалить комментарий"
                        >
                          <Trash2 className="w-4 h-4" />
                        </TapScaleButton>
                      ) : null}
                      <TapScaleButton
                        type="button"
                        onClick={() => toggleLike(comment.id)}
                        haptic
                        className="p-1.5 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                        aria-label={comment.isLiked ? "Убрать лайк" : "Нравится"}
                      >
                        <Heart
                          className={cn(
                            "w-4 h-4 transition-colors",
                            comment.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground"
                          )}
                        />
                      </TapScaleButton>
                      {comment.likes > 0 && (
                        <span className="text-xs text-muted-foreground">{comment.likes}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 pt-2 border-t border-border/50 pb-[max(var(--uix-space-2),env(safe-area-inset-bottom,0px))] bg-background shrink-0">
              <div className="flex items-end gap-3 bg-secondary/50 rounded-3xl p-1.5 pl-4 border border-border/50">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  placeholder={user ? "Оставить комментарий..." : "Войдите, чтобы комментировать"}
                  disabled={!user}
                  className="flex-1 bg-transparent border-none outline-none py-2.5 text-[15px] placeholder:text-muted-foreground disabled:opacity-60"
                />
                <TapScaleButton
                  type="button"
                  onClick={() => handleSend()}
                  disabled={!newComment.trim() || sending || !user}
                  haptic
                  className="p-2.5 rounded-full bg-primary text-primary-foreground shrink-0 disabled:opacity-50 disabled:bg-secondary disabled:text-muted-foreground transition-all min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                  aria-label="Отправить комментарий"
                >
                  <Send className="w-5 h-5 ml-0.5" />
                </TapScaleButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalNode, document.body);
}
