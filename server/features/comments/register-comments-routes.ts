import type { Express } from "express";
import { registerPostCommentLikeRoute } from "./comment-reactions/post-comment-like-route";
import { registerDeleteCommentRoute } from "./comment-moderation/delete-comment-route";
import { registerGetPostCommentsRoute } from "./post-comments/get-comments-route";
import { registerPostCommentRoute } from "./post-comments/post-comment-route";

export function registerCommentsRoutes(app: Express): void {
  registerGetPostCommentsRoute(app);
  registerPostCommentRoute(app);
  registerPostCommentLikeRoute(app);
  registerDeleteCommentRoute(app);
}
