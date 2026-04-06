import type { RefObject } from "react";
import { MessageCircle } from "lucide-react";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { ListEmptyState } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { DisplayComment } from "../shared/types";
import type { CommentItem } from "../shared/types";
import { CommentRow } from "./CommentRow";

type AuthUser = { id?: string } | null;

export function CommentsModalList({
  loading,
  displayComments,
  user,
  postAuthorId,
  deletingId,
  textareaRef,
  onReply,
  onDelete,
  onToggleLike,
  onShare,
  onBlockRequest,
  onReportComment,
  onReplyAuthError,
  targetCommentId,
  highlightedCommentId,
  onOpenParentComment,
}: {
  loading: boolean;
  displayComments: DisplayComment[];
  user: AuthUser;
  postAuthorId?: string | null;
  deletingId: string | null;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onReply: (c: CommentItem) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
  onShare?: (commentId: string) => void;
  onBlockRequest: (userId: string, name: string) => void;
  onReportComment?: (commentId: string) => void;
  onReplyAuthError: () => void;
  targetCommentId?: string | null;
  highlightedCommentId?: string | null;
  onOpenParentComment?: (commentId: string) => void;
}) {
  if (loading) {
    return (
      <LoadingProgress loading minHeight="160px" className="rounded-lg flex-1 min-h-[160px]">
        <div className="min-h-[160px]" />
      </LoadingProgress>
    );
  }

  if (displayComments.length === 0) {
    return (
      <ListEmptyState
        icon={MessageCircle}
        title="Пока нет комментариев"
        description="Можно упомянуть людей через @ — как в чате"
        actionLabel={user ? "Написать комментарий" : undefined}
        onAction={user ? () => textareaRef.current?.focus() : undefined}
        className="py-8"
      />
    );
  }

  return (
    <ul className="flex list-none flex-col p-0 m-0">
      {displayComments.map((comment, index) => (
        <li
          key={comment.id}
          className={cn(index > 0 && "mt-3 border-t border-border/40 pt-3")}
        >
          <CommentRow
            comment={comment}
            user={user}
            postAuthorId={postAuthorId}
            deletingId={deletingId}
            onReply={onReply}
            onDelete={onDelete}
            onToggleLike={onToggleLike}
            onShare={onShare}
            onBlockRequest={onBlockRequest}
            onReportComment={onReportComment}
            onReplyAuthError={onReplyAuthError}
            isTarget={targetCommentId === comment.id}
            isHighlighted={highlightedCommentId === comment.id}
            onOpenParentComment={onOpenParentComment}
          />
        </li>
      ))}
    </ul>
  );
}
