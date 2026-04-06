import type { ContentReportTargetType } from "@shared/schema/content-reports";
import { CONTENT_REPORT_TARGET_TYPES } from "@shared/schema/content-reports";

export function isValidReportTargetType(t: string): t is ContentReportTargetType {
  return (CONTENT_REPORT_TARGET_TYPES as readonly string[]).includes(t);
}
