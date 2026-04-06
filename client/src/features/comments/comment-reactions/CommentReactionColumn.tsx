import { Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { DisplayComment } from "../shared/types";
import { CommentDeleteButton } from "../comment-moderation/CommentDeleteButton";

export function CommentReactionColumn({
  comment,
  canDelete,
  deletingId,
  onDelete,
  onToggleLike,
  onShare,
  hideShare = false,
}: {
  comment: DisplayComment;
  canDelete: boolean;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
  onShare?: (id: string) => void;
  /** «Поделиться» вынесено в строку действий у текста (как во ВКонтакте). */
  hideShare?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
      {canDelete ? (
        <CommentDeleteButton
          commentId={comment.id}
          disabled={deletingId === comment.id}
          onDelete={() => onDelete(comment.id)}
        />
      ) : null}
      <TapScaleButton
        type="button"
        onClick={() => onToggleLike(comment.id)}
        haptic
        className="p-1.5 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
        aria-label={comment.isLiked ? "Убрать лайк" : "Нравится"}
      >
        <Heart
          className={cn(
            "w-4 h-4 transition-colors",
            comment.isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground",
          )}
        />
      </TapScaleButton>
      {comment.displayLikes > 0 && (
        <span className="text-xs text-muted-foreground">{comment.displayLikes}</span>
      )}
      {onShare && !hideShare ? (
        <TapScaleButton
          type="button"
          onClick={() => onShare(comment.id)}
          haptic
          className="p-1.5 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
          aria-label="Поделиться комментарием"
        >
          <Share2 className="w-4 h-4 text-muted-foreground" />
        </TapScaleButton>
      ) : null}
    </div>
  );
}
