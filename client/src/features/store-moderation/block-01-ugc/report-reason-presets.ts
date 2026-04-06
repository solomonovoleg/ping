import type { ContentReportReasonCode } from "@shared/schema/content-reports";

export type ReportReasonPreset = { id: ContentReportReasonCode; label: string };

export const REPORT_REASON_PRESETS: ReportReasonPreset[] = [
  { id: "spam", label: "Спам или реклама" },
  { id: "harassment", label: "Оскорбления или домогательства" },
  { id: "violence", label: "Насилие или угрозы" },
  { id: "adult", label: "Контент 18+ или сексуальный" },
  { id: "illegal", label: "Незаконный контент" },
  { id: "other", label: "Другое" },
];

export function buildReportReasonText(presetId: ContentReportReasonCode, detailsTrimmed: string): string {
  const preset = REPORT_REASON_PRESETS.find((p) => p.id === presetId);
  const base = (preset?.label ?? "Другое").trim();
  const d = detailsTrimmed.trim();
  const combined = d ? `${base}: ${d}` : base;
  const out = combined.slice(0, 2000);
  return out.length >= 3 ? out : `${base}.`;
}
