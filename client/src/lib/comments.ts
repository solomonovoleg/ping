/**
 * Публичный API комментариев к постам.
 * Реализация: `client/src/features/comments/` (модуль по подпапкам).
 */
import { createCommentOnPost } from "@/features/comments/post-comments/create-comment-on-post";
import { createReplyToComment } from "@/features/comments/comment-replies/create-reply-to-comment";

export type { CommentItem } from "@/features/comments/shared/types";
export { formatCommentTime } from "@/features/comments/shared/format-comment-time";
export { fetchCommentsForPost as fetchComments } from "@/features/comments/post-comments/fetch-comments-for-post";
export { deletePostComment as deleteComment } from "@/features/comments/comment-moderation/delete-post-comment";
export { createCommentOnPost };

export async function createComment(
  postId: string | number,
  text: string,
  opts?: { parentCommentId?: string | null },
) {
  if (opts?.parentCommentId) {
    return createReplyToComment(postId, text, opts.parentCommentId);
  }
  return createCommentOnPost(postId, text);
}
