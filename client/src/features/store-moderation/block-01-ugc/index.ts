/**
 * Блок 1: жалобы на UGC для модерации сторов (чат, пост, профиль, сториз, комментарий).
 * @see ./README.md
 */
export type { Block01ReportTarget } from "./types";
export { ReportContentDialog } from "./ReportContentDialog";
export { block01ugcRu } from "./i18n.ru";
export { submitContentReport } from "./submit-content-report";
export type { SubmitContentReportInput, SubmitContentReportResult } from "./submit-content-report";
