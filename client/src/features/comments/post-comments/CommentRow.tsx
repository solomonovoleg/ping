import { useLocation } from "wouter";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { buildProfilePath } from "@/lib/profile-route";
import { CommentRichText } from "../comment-mentions/CommentRichText";
import type { DisplayComment } from "../shared/types";
import type { CommentItem } from "../shared/types";
import { CommentReactionColumn } from "../comment-reactions/CommentReactionColumn";
import { CommentBlockMenu } from "../comment-moderation/CommentBlockMenu";
import { canDeletePostComment } from "../comment-moderation/can-delete-post-comment";
import { stripLeadingReplyMention } from "../comment-replies/strip-leading-reply-mention";
import { cn } from "@/lib/utils";

type AuthUser = { id?: string } | null;

export function CommentRow({
  comment,
  user,
  postAuthorId,
  deletingId,
  onReply,
  onDelete,
  onToggleLike,
  onShare,
  onBlockRequest,
  onReportComment,
  onReplyAuthError,
  isTarget = false,
  isHighlighted = false,
  onOpenParentComment,
}: {
  comment: DisplayComment;
  user: AuthUser;
  postAuthorId?: string | null;
  deletingId: string | null;
  onReply: (c: CommentItem) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
  onShare?: (id: string) => void;
  onBlockRequest: (userId: string, name: string) => void;
  /** Жалоба на комментарий (блок 1 store-moderation), `targetType: comment`. */
  onReportComment?: (commentId: string) => void;
  onReplyAuthError: () => void;
  isTarget?: boolean;
  isHighlighted?: boolean;
  onOpenParentComment?: (commentId: string) => void;
}) {
  const [, setLocation] = useLocation();
  const canInteractOthers = !!user?.id && !!comment.userId && comment.userId !== user.id;
  const canReport = canInteractOthers && Boolean(onReportComment);
  const canDelete = canDeletePostComment(comment, {
    currentUserId: user?.id,
    postAuthorId,
  });
  const isReply = Boolean(comment.parentCommentId);
  const parentLabel = comment.parentAuthorName?.trim() || null;

  const goToParent = () => {
    if (!comment.parentCommentId) return;
    triggerLightHaptic();
    onOpenParentComment?.(comment.parentCommentId);
  };

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm";

  const metaLinkClass = cn(
    "min-h-[var(--uix-touch-min)] inline-flex items-center rounded-md px-0.5 font-medium text-muted-foreground hover:text-foreground transition-colors",
    focusRing,
  );

  const replyBodyText =
    isReply && parentLabel ? stripLeadingReplyMention(comment.text, parentLabel) : comment.text;

  const canOpenCommentAuthorProfile = Boolean(comment.userId);
  const commentAuthorProfilePath = canOpenCommentAuthorProfile
    ? buildProfilePath({
        userId: comment.userId,
        publicId: comment.publicId ?? undefined,
        fallbackPath: "/posts",
      })
    : null;

  const openCommentAuthorProfile = () => {
    if (!commentAuthorProfilePath) return;
    setLocation(commentAuthorProfilePath);
  };

  const commentBodyAndMeta = (
    <>
      {isReply && parentLabel ? (
        <div className="mb-1 text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          <button
            type="button"
            onClick={goToParent}
            disabled={!comment.parentCommentId}
            className={cn(
              "inline p-0 align-baseline font-medium text-primary hover:underline underline-offset-2 disabled:pointer-events-none disabled:opacity-60 bg-transparent border-0 cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
            )}
            aria-label={`Перейти к комментарию ${parentLabel}`}
          >
            {parentLabel}
          </button>
          <span className="text-foreground">, </span>
          <CommentRichText text={replyBodyText} inline />
        </div>
      ) : (
        <CommentRichText text={comment.text} />
      )}

      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span>{comment.time}</span>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={() => {
            if (!user) {
              onReplyAuthError();
              return;
            }
            triggerLightHaptic();
            onReply(comment);
          }}
          className={metaLinkClass}
          aria-label={`Ответить на комментарий ${comment.user}`}
        >
          Ответить
        </button>
        {onShare ? (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => {
                triggerLightHaptic();
                onShare(comment.id);
              }}
              className={metaLinkClass}
              aria-label="Поделиться комментарием"
            >
              Поделиться
            </button>
          </>
        ) : null}
        {canReport ? (
          <>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onReplyAuthError();
                  return;
                }
                triggerLightHaptic();
                onReportComment?.(comment.id);
              }}
              className={metaLinkClass}
              aria-label={`Пожаловаться на комментарий ${comment.user}`}
            >
              Пожаловаться
            </button>
          </>
        ) : null}
      </div>
    </>
  );

  const commentBodyWrapped =
    canInteractOthers && comment.userId ? (
      <CommentBlockMenu
        canInteract
        commentId={comment.id}
        commentUserId={comment.userId}
        commentUserName={comment.user}
        onReportRequest={onReportComment}
        onBlockRequest={onBlockRequest}
      >
        {commentBodyAndMeta}
      </CommentBlockMenu>
    ) : (
      commentBodyAndMeta
    );

  return (
    <div
      data-comment-id={comment.id}
      className={cn(
        "transition-colors",
        (isTarget || isHighlighted) && "rounded-xl bg-primary/10 ring-1 ring-primary/35 px-2 py-1.5 -mx-2",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-3",
          /* Один уровень отступа для всех ответов (без «лесенки» и без превью родителя). */
          isReply && "pl-12",
        )}
      >
        <TapScaleButton
          type="button"
          disabled={!canOpenCommentAuthorProfile}
          onClick={openCommentAuthorProfile}
          haptic={canOpenCommentAuthorProfile}
          className={cn(
            "shrink-0 rounded-full border-0 bg-transparent p-0 shadow-none",
            focusRing,
            !canOpenCommentAuthorProfile && "cursor-default",
          )}
          aria-label={canOpenCommentAuthorProfile ? `Профиль: ${comment.user}` : undefined}
        >
          <UserAvatar
            avatarUrl={comment.avatar}
            displayName={comment.user}
            seed={comment.userId ?? comment.user}
            size={36}
            className="shrink-0"
            pointerEventsNone={canOpenCommentAuthorProfile}
          />
        </TapScaleButton>
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-[14px] leading-snug">
            <TapScaleButton
              type="button"
              disabled={!canOpenCommentAuthorProfile}
              onClick={openCommentAuthorProfile}
              haptic={canOpenCommentAuthorProfile}
              subtle
              className={cn(
                "max-w-full min-h-[var(--uix-touch-min)] rounded-md px-0.5 text-left font-semibold text-foreground transition-colors",
                canOpenCommentAuthorProfile && "hover:text-primary",
                focusRing,
                !canOpenCommentAuthorProfile && "cursor-default",
              )}
              aria-label={canOpenCommentAuthorProfile ? `Профиль: ${comment.user}` : undefined}
            >
              <span className="truncate">{comment.user}</span>
            </TapScaleButton>
            {isReply && parentLabel ? (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  onClick={goToParent}
                  disabled={!comment.parentCommentId}
                  className={cn(
                    "max-w-full truncate text-left font-normal text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-60",
                    focusRing,
                  )}
                  aria-label={`Перейти к комментарию ${parentLabel}`}
                >
                  {parentLabel}
                </button>
              </>
            ) : null}
          </div>

          {commentBodyWrapped}
        </div>
        <CommentReactionColumn
          comment={comment}
          canDelete={canDelete}
          deletingId={deletingId}
          onDelete={onDelete}
          onToggleLike={onToggleLike}
          onShare={onShare}
          hideShare={Boolean(onShare)}
        />
      </div>
    </div>
  );
}
