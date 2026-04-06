import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { triggerSuccessFeedback } from "@/lib/micro-feedback";
import { usePrefersReducedMotion } from "@/lib/motion";
import { UserBlockAlertDialog } from "@/features/user-blocking";
import { ReportContentDialog } from "@/features/store-moderation/block-01-ugc";
import type { CommentItem } from "../shared/types";
import { invalidatePostCommentQueries } from "../shared/invalidate-post-comment-queries";
import { createCommentOnPost } from "./create-comment-on-post";
import { useCommentsModalLoad } from "./use-comments-modal-load";
import { createReplyToComment } from "../comment-replies/create-reply-to-comment";
import { useOptimisticCommentLikes } from "../comment-reactions/use-optimistic-comment-likes";
import type { CommentSortMode } from "../comment-reactions/use-optimistic-comment-likes";
import { deletePostComment } from "../comment-moderation/delete-post-comment";
import { CommentsModalList } from "./CommentsModalList";
import { CommentsModalFrame } from "./CommentsModalFrame";
import { CommentsModalComposer } from "./CommentsModalComposer";
import { CommentsModalErrorBanner } from "./CommentsModalErrorBanner";

export interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number | string | null;
  postAuthorId?: string | null;
  targetCommentId?: string | null;
  onShareCommentToChat?: (comment: CommentItem) => void;
}

export default function CommentsModal({
  isOpen,
  onClose,
  postId,
  postAuthorId,
  targetCommentId = null,
  onShareCommentToChat,
}: CommentsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { comments, setComments, loading, setLoading, error, setError } = useCommentsModalLoad(
    isOpen,
    postId,
  );
  const [sending, setSending] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [blockTarget, setBlockTarget] = useState<{ userId: string; name: string } | null>(null);
  const [reportComment, setReportComment] = useState<{
    id: string;
    contextLine: string;
    contextPostId: string;
  } | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);
  const [sortMode, setSortMode] = useState<CommentSortMode>("interesting");
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const bumpPostQueries = useCallback(() => {
    invalidatePostCommentQueries(queryClient, { postId, postAuthorId });
  }, [postAuthorId, postId, queryClient]);

  const { displayComments, toggleLike } = useOptimisticCommentLikes(
    comments,
    postId,
    setComments,
    setError,
    sortMode,
  );
  const reducedMotion = usePrefersReducedMotion();

  const handleToggleLike = useCallback(
    (id: string) => {
      if (!user) {
        setError("Войдите, чтобы оценить комментарий");
        return;
      }
      void toggleLike(id);
    },
    [user, toggleLike, setError],
  );

  useEffect(() => {
    if (!isOpen || postId == null) setReplyingTo(null);
  }, [isOpen, postId]);

  useEffect(() => {
    if (!isOpen) return;
    setSortMode("interesting");
  }, [isOpen, postId]);

  useEffect(() => {
    if (!isOpen || !targetCommentId) return;
    const id = window.setTimeout(() => {
      const target = panelRef.current?.querySelector(`[data-comment-id="${targetCommentId}"]`) as HTMLElement | null;
      if (!target) return;
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      setHighlightedCommentId(targetCommentId);
    }, 120);
    return () => window.clearTimeout(id);
  }, [isOpen, targetCommentId, displayComments.length, reducedMotion]);

  useEffect(() => {
    if (!highlightedCommentId) return;
    if (highlightTimeoutRef.current) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = window.setTimeout(() => {
      setHighlightedCommentId(null);
      highlightTimeoutRef.current = null;
    }, 1700);
    return () => {
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [highlightedCommentId]);

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
      const created = replyingTo
        ? await createReplyToComment(postId, text, replyingTo.id)
        : await createCommentOnPost(postId, text);
      if (created) {
        setComments((prev) => [created, ...prev]);
        setNewComment("");
        setReplyingTo(null);
        triggerSuccessFeedback();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить комментарий");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (postId == null || !user) return;
    if (!window.confirm("Удалить этот комментарий?")) return;
    setDeletingId(commentId);
    setError(null);
    try {
      await deletePostComment(postId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      bumpPostQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить комментарий");
    } finally {
      setDeletingId(null);
    }
  };

  const openCommentReport = useCallback(
    (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      const preview = comment?.text?.trim() ?? "";
      const contextLine =
        preview.length > 0
          ? `Комментарий к посту ${postId ?? ""}: «${preview.slice(0, 120)}${preview.length > 120 ? "…" : ""}»`
          : `Комментарий к посту ${postId ?? ""}`;
      setReportComment({
        id: commentId,
        contextLine,
        contextPostId: postId != null ? String(postId) : "",
      });
    },
    [comments, postId],
  );

  const errorBanner = error ? (
    <CommentsModalErrorBanner
      error={error}
      postId={postId}
      setComments={setComments}
      setLoading={setLoading}
      setError={setError}
    />
  ) : null;

  const modalNode = (
    <CommentsModalFrame
      isOpen={isOpen}
      onClose={() => onClose?.()}
      reducedMotion={reducedMotion}
      panelRef={panelRef}
      closeButtonRef={closeButtonRef}
      commentCount={comments.length}
      sortMode={sortMode}
      onSortChange={setSortMode}
      errorBanner={errorBanner}
      listArea={
        <CommentsModalList
          loading={loading}
          displayComments={displayComments}
          user={user}
          postAuthorId={postAuthorId}
          deletingId={deletingId}
          textareaRef={textareaRef}
          onReply={(c) => {
            setReplyingTo(c);
            setError(null);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
          onDelete={handleDeleteComment}
          onToggleLike={handleToggleLike}
          onShare={(commentId) => {
            const comment = comments.find((c) => c.id === commentId);
            if (!comment || !onShareCommentToChat) return;
            onShareCommentToChat(comment);
          }}
          onBlockRequest={(userId, name) => setBlockTarget({ userId, name })}
          onReportComment={user ? openCommentReport : undefined}
          onReplyAuthError={() => setError("Войдите, чтобы ответить на комментарий")}
          targetCommentId={targetCommentId}
          highlightedCommentId={highlightedCommentId}
          onOpenParentComment={(commentId) => {
            const target = panelRef.current?.querySelector(`[data-comment-id="${commentId}"]`) as HTMLElement | null;
            if (!target) return;
            target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
            setHighlightedCommentId(commentId);
          }}
        />
      }
      footer={
        <CommentsModalComposer
          textareaRef={textareaRef}
          value={newComment}
          onChange={setNewComment}
          onSend={() => void handleSend()}
          sending={sending}
          userPresent={!!user}
          currentUserId={user?.id}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
        />
      }
    />
  );

  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(modalNode, document.body)}
      <UserBlockAlertDialog
        open={!!blockTarget}
        onOpenChange={(o) => {
          if (!o) setBlockTarget(null);
        }}
        targetUserId={blockTarget?.userId ?? null}
        targetDisplayName={blockTarget?.name}
        initialPreset="socialOnly"
        onBlocked={() => {
          setBlockTarget(null);
          bumpPostQueries();
        }}
      />
      <ReportContentDialog
        open={reportComment !== null}
        onOpenChange={(o) => {
          if (!o) setReportComment(null);
        }}
        target={
          reportComment
            ? {
                targetType: "comment" as const,
                targetId: reportComment.id,
                ...(reportComment.contextPostId ? { contextPostId: reportComment.contextPostId } : {}),
              }
            : null
        }
        contextLine={reportComment?.contextLine}
      />
    </>
  );
}
