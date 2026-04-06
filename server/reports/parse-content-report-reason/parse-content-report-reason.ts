import { isContentReportReasonCode } from "@shared/schema/content-reports";

export type ParsedContentReportReason = { reasonCode: string | null; reasonText: string };

export type ParseContentReportReasonErrorKey =
  | "reportBadReasonCode"
  | "reportOtherNeedsDetails"
  | "reportLegacyReasonTooShort";

/** Parses `reasonCode` + `reason`, or legacy `reason` only (min length 3). */
export function parseContentReportReason(body: unknown):
  | { ok: true; value: ParsedContentReportReason }
  | { ok: false; key: ParseContentReportReasonErrorKey } {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const reasonRaw = typeof b.reason === "string" ? b.reason.trim() : "";
  const codeRaw = typeof b.reasonCode === "string" ? b.reasonCode.trim() : "";

  if (codeRaw) {
    if (!isContentReportReasonCode(codeRaw)) {
      return { ok: false, key: "reportBadReasonCode" };
    }
    if (codeRaw === "other" && reasonRaw.length < 3) {
      return { ok: false, key: "reportOtherNeedsDetails" };
    }
    const reasonText =
      reasonRaw.length > 0 ? reasonRaw.slice(0, 2000) : `[${codeRaw}]`;
    return { ok: true, value: { reasonCode: codeRaw, reasonText } };
  }

  if (reasonRaw.length < 3) {
    return { ok: false, key: "reportLegacyReasonTooShort" };
  }
  return { ok: true, value: { reasonCode: null, reasonText: reasonRaw.slice(0, 2000) } };
}
