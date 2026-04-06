import { eq } from "drizzle-orm";
import { postComments } from "@shared/schema";
import { getDb } from "../../db";
import { ReportsTargetValidationError } from "../reports-target-validation-error";
import { validatePostReport } from "../validate-post-report/validate-post-report";

export type CommentReportContext = { contextPostId?: string };

export async function validateCommentReport(
  reporterUserId: string,
  targetId: string,
  ctx?: CommentReportContext,
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  const [row] = await db
    .select({ postId: postComments.postId, userId: postComments.userId })
    .from(postComments)
    .where(eq(postComments.id, targetId))
    .limit(1);
  if (!row) {
    throw new ReportsTargetValidationError(404, "Комментарий не найден");
  }
  if (row.userId === reporterUserId) {
    throw new ReportsTargetValidationError(400, "Нельзя пожаловаться на свой комментарий");
  }
  const expectedPost = ctx?.contextPostId?.trim();
  if (expectedPost && row.postId !== expectedPost) {
    throw new ReportsTargetValidationError(400, "Пост не совпадает с комментарием");
  }
  await validatePostReport(reporterUserId, row.postId);
}
