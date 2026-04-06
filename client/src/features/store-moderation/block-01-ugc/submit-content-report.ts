import type { ContentReportReasonCode } from "@shared/schema/content-reports";
import { API, apiFetch, messageForFetchFailure } from "@/lib/api-base";
import { block01ugcRu } from "./i18n.ru";
import type { Block01ReportTarget } from "./types";

const REPORT_DEBUG = "[ping:report]";

type ReportResponseJson = {
  message?: string;
  id?: string;
  duplicate?: boolean;
};

function logReportFailure(
  phase: "network" | "http" | "parse",
  detail: Record<string, unknown>,
): void {
  try {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(REPORT_DEBUG, phase, detail);
    }
  } catch {
    /* ignore */
  }
}

export type SubmitContentReportInput = Block01ReportTarget & {
  reason: string;
  reasonCode: ContentReportReasonCode;
};

export type SubmitContentReportResult = { id: string; message?: string; duplicate?: boolean };

export async function submitContentReport(input: SubmitContentReportInput): Promise<SubmitContentReportResult> {
  let res: Response;
  try {
    res = await apiFetch(`${API}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: input.targetType,
        targetId: input.targetId,
        reasonCode: input.reasonCode,
        reason: input.reason,
        ...(input.contextPostId?.trim() ? { contextPostId: input.contextPostId.trim() } : {}),
        ...(input.contextChatId?.trim() ? { contextChatId: input.contextChatId.trim() } : {}),
      }),
    });
  } catch (e) {
    logReportFailure("network", {
      error: e instanceof Error ? e.message : String(e),
      targetType: input.targetType,
    });
    throw new Error(messageForFetchFailure(e));
  }

  const requestId = res.headers.get("x-request-id")?.trim() || null;
  const text = await res.text();
  let raw: ReportResponseJson | null = null;
  let jsonParseFailed = false;
  if (text.trim()) {
    try {
      raw = JSON.parse(text) as ReportResponseJson;
    } catch {
      jsonParseFailed = true;
    }
  }

  if (!res.ok) {
    const fromServer = typeof raw?.message === "string" && raw.message.trim() ? raw.message.trim() : "";
    logReportFailure("http", {
      status: res.status,
      statusText: res.statusText,
      requestId,
      message: fromServer || null,
      jsonParseFailed,
      bodyPreview:
        !fromServer && text.trim() ? text.slice(0, 280).replace(/\s+/g, " ") : null,
      targetType: input.targetType,
      targetId: input.targetId.slice(0, 64),
    });
    if (res.status === 429) {
      throw new Error(fromServer || block01ugcRu.errorRateLimited);
    }
    const msg = fromServer || `Код ${res.status}`;
    throw new Error(msg);
  }

  const id = typeof raw?.id === "string" ? raw.id : "";
  if (!id) {
    logReportFailure("parse", {
      status: res.status,
      requestId,
      hint: jsonParseFailed ? "ответ не JSON" : "успешный статус без id в JSON",
      bodyPreview: text ? text.slice(0, 280).replace(/\s+/g, " ") : "(пустое тело)",
    });
    throw new Error("Пустой ответ сервера");
  }
  return {
    id,
    message: typeof raw?.message === "string" ? raw.message : undefined,
    duplicate: raw?.duplicate === true,
  };
}
