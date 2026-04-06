import { assertStoryReportableByViewer } from "../../stories/story-viewer-access/story-viewer-access";
import { StoriesServiceError } from "../../stories/stories-service-error/stories-service-error";
import { ReportsTargetValidationError } from "../reports-target-validation-error";

export async function validateStoryReport(reporterUserId: string, targetId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    await assertStoryReportableByViewer(reporterUserId, targetId);
  } catch (e) {
    if (e instanceof StoriesServiceError) {
      throw new ReportsTargetValidationError(e.status, e.message);
    }
    throw e;
  }
}
