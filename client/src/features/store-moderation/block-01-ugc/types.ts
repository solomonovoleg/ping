import type { ContentReportTargetType } from "@shared/schema/content-reports";

/** Цель жалобы для API `/api/reports` (блок 1). */
export type Block01ReportTarget = {
  targetType: ContentReportTargetType;
  targetId: string;
  /** Для `comment`: UUID поста (диплинк и колонка `context_post_id`). */
  contextPostId?: string;
  /** Для `message`: id чата (диплинк и колонка `context_chat_id`). */
  contextChatId?: string;
};
