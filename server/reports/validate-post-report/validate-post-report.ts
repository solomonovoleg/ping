import { getPostByIdDetailed } from "../../posts/get-post-by-id-detailed";
import { PostsServiceError } from "../../posts/posts-service-error";
import { ReportsTargetValidationError } from "../reports-target-validation-error";

export async function validatePostReport(reporterUserId: string, targetId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    const post = await getPostByIdDetailed(targetId, reporterUserId);
    if (post.authorId === reporterUserId) {
      throw new ReportsTargetValidationError(400, "Нельзя пожаловаться на свой пост");
    }
  } catch (e) {
    if (e instanceof PostsServiceError) {
      throw new ReportsTargetValidationError(e.status, e.message);
    }
    throw e;
  }
}
