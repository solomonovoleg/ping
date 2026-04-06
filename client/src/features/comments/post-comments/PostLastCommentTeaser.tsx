import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/posts";

export type PostLastCommentPreview = NonNullable<FeedPost["latestComments"]>[number];

export function pickNewestCommentPreview(latest: FeedPost["latestComments"] | undefined): PostLastCommentPreview | null {
  const list = Array.isArray(latest) ? latest : [];
  if (list.length === 0) return null;
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;
}

type PostLastCommentTeaserProps = {
  comment: PostLastCommentPreview;
  commentsCount: number;
  onOpen: () => void;
  ariaLabel: string;
  className?: string;
  /** Профиль PULSE: цвет текста с темы */
  style?: CSSProperties;
  moreHint?: string;
};

/**
 * Одна строка: последний комментарий + приглушённый «ещё», если комментариев больше одного (как в лентах крупных сетей).
 */
export function PostLastCommentTeaser({
  comment,
  commentsCount,
  onOpen,
  ariaLabel,
  className,
  style,
  moreHint = "ещё",
}: PostLastCommentTeaserProps) {
  const showMore = commentsCount > 1;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn(
        "w-full min-h-[var(--uix-touch-min)] py-1 text-left transition-opacity hover:opacity-90 active:opacity-80",
        !style && "text-foreground",
        className,
      )}
      style={style}
      aria-label={ariaLabel}
    >
      <p className="line-clamp-1 min-w-0 text-[13px] leading-snug break-all">
        <span className="font-semibold">{comment.user}</span>
        <span className="font-normal opacity-90"> {comment.text}</span>
        {showMore ? <span className="whitespace-nowrap font-normal text-muted-foreground"> · {moreHint}</span> : null}
      </p>
    </button>
  );
}
