/** Парсинг JSON вложения `type: file` (PDF / CSV / XLSX) и определение вида карточки. */

export const CHAT_FILE_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ChatFileAttachmentKind = "pdf" | "csv" | "xlsx";

export function chatFileAttachmentKind(mimeRaw: string, nameRaw: string): ChatFileAttachmentKind {
  const mime = mimeRaw.toLowerCase();
  const name = nameRaw.toLowerCase();
  if (mime === "text/csv" || mime === "application/csv" || name.endsWith(".csv")) return "csv";
  if (mime === CHAT_FILE_XLSX_MIME || name.endsWith(".xlsx")) return "xlsx";
  return "pdf";
}

function safeSegment(raw: string, fallbackBase: string): string {
  return raw.trim().replace(/[/\\?*|":<>]/g, "_").slice(0, 180) || fallbackBase;
}

export function chatAttachmentDownloadFilename(mime: string, name: string): string {
  const kind = chatFileAttachmentKind(mime, name);
  const ts = Date.now();
  if (kind === "csv") {
    const base = safeSegment(name, `table-${ts}`);
    return base.toLowerCase().endsWith(".csv") ? base : `${base}.csv`;
  }
  if (kind === "xlsx") {
    const base = safeSegment(name, `table-${ts}`);
    return base.toLowerCase().endsWith(".xlsx") ? base : `${base}.xlsx`;
  }
  const base = safeSegment(name, `document-${ts}`);
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export function parseChatFilePayload(content: string): {
  url: string;
  name: string;
  size: number;
  mime: string;
} | null {
  try {
    const p = JSON.parse(content) as { url?: string; name?: string; size?: number; mime?: string };
    const url = typeof p.url === "string" ? p.url.trim() : "";
    if (!url) return null;
    const mime = typeof p.mime === "string" ? p.mime.trim().toLowerCase() : "";
    const name = typeof p.name === "string" && p.name.trim() ? p.name.trim() : "";
    const kind = chatFileAttachmentKind(mime, name || "document.pdf");
    const defaultName =
      kind === "csv" ? "table.csv" : kind === "xlsx" ? "table.xlsx" : "Документ.pdf";
    const outMime =
      mime || (kind === "csv" ? "text/csv" : kind === "xlsx" ? CHAT_FILE_XLSX_MIME : "application/pdf");
    return {
      url,
      name: name || defaultName,
      size: typeof p.size === "number" ? p.size : 0,
      mime: outMime,
    };
  } catch {
    return null;
  }
}
