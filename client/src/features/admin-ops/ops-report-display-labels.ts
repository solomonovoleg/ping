import type { ContentReportReasonCode } from "@shared/schema/content-reports";
import { CONTENT_REPORT_REASON_CODES } from "@shared/schema/content-reports";

const REASON_RU: Record<ContentReportReasonCode, string> = {
  spam: "Спам / реклама",
  harassment: "Оскорбления / домогательства",
  violence: "Насилие / угрозы",
  adult: "18+ / сексуальный контент",
  illegal: "Незаконный контент",
  other: "Другое",
};

const STATUS_RU: Record<string, string> = {
  open: "Открыта",
  resolved: "Решена",
  dismissed: "Отклонена",
};

export function formatOpsReportReasonCode(code: string | null | undefined): string {
  if (!code) return "—";
  if ((CONTENT_REPORT_REASON_CODES as readonly string[]).includes(code)) {
    return REASON_RU[code as ContentReportReasonCode];
  }
  return code;
}

export function formatOpsReportStatus(status: string): string {
  return STATUS_RU[status] ?? status;
}
