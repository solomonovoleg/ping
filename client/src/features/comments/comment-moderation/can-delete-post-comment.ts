import type { CommentItem } from "../shared/types";

export function canDeletePostComment(
  comment: CommentItem,
  opts: { currentUserId: string | undefined; postAuthorId: string | null | undefined },
): boolean {
  const { currentUserId, postAuthorId } = opts;
  if (!currentUserId) return false;
  if (comment.userId === currentUserId) return true;
  if (postAuthorId && postAuthorId === currentUserId) return true;
  return false;
}
