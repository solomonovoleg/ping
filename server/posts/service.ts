/**
 * Публичный API домена постов платформы.
 * Реализация разнесена по модулям в этой папке; здесь только реэкспорты для `routes.ts` и внешних импортов.
 */
export { assertPostReadableByViewer } from "./post-access";
export { createPost, type CreatePostInput } from "./create-post";
export {
  recordPostEngagement,
  recordPostView,
  type PostEngagementInput,
} from "./post-engagement";
export {
  deleteOwnPost,
  updateOwnPost,
  type UpdatePostInput,
} from "./post-mutate";
export { parsePostEdgeId } from "./post-edge-id";
export { PostsServiceError } from "./posts-service-error";
export { savePost, sharePostToUser, unsavePost } from "./post-share-save";
export { listPostsForViewer } from "./list-posts-for-viewer";
export { getPostByIdDetailed } from "./get-post-by-id-detailed";
export { listSavedPostsDetailed } from "./list-saved-posts-detailed";
