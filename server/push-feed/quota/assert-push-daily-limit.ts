import { PostsServiceError } from "../../posts/posts-service-error";
import { MAX_PUSH_POSTS_PER_DAY_DEFAULT } from "../constants/push-limits";
import { countAuthorPushPostsInDailyWindow } from "../db/push-posts.queries";

export async function assertPushDailyLimit(authorId: string): Promise<void> {
  const used = await countAuthorPushPostsInDailyWindow(authorId);
  if (used >= MAX_PUSH_POSTS_PER_DAY_DEFAULT) {
    throw new PostsServiceError(
      429,
      `Лимит Push исчерпан: не более ${MAX_PUSH_POSTS_PER_DAY_DEFAULT} публикаций за 24 часа`,
    );
  }
}
