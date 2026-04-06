import type { ContentReportTargetType } from "@shared/schema/content-reports";
import { ReportsTargetValidationError } from "../reports-target-validation-error";
import { validateCommentReport } from "../validate-comment-report/validate-comment-report";
import { validateMessageReport } from "../validate-message-report/validate-message-report";
import { validatePostReport } from "../validate-post-report/validate-post-report";
import { validateStoryReport } from "../validate-story-report/validate-story-report";
import { validateUserReport } from "../validate-user-report/validate-user-report";

export { ReportsTargetValidationError } from "../reports-target-validation-error";

/** Extra ids for admin deep links (comment → post, message → chat). */
export type ReportTargetValidationContext = {
  contextPostId?: string;
  contextChatId?: string;
};

export async function validateReportTarget(
  reporterUserId: string,
  targetType: ContentReportTargetType,
  targetId: string,
  ctx?: ReportTargetValidationContext,
): Promise<void> {
  switch (targetType) {
    case "message":
      await validateMessageReport(reporterUserId, targetId, { contextChatId: ctx?.contextChatId });
      return;
    case "user":
      await validateUserReport(reporterUserId, targetId);
      return;
    case "post":
      await validatePostReport(reporterUserId, targetId);
      return;
    case "story":
      await validateStoryReport(reporterUserId, targetId);
      return;
    case "comment":
      await validateCommentReport(reporterUserId, targetId, { contextPostId: ctx?.contextPostId });
      return;
    default:
      return;
  }
}
