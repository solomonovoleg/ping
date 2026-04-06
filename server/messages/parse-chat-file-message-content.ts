import { MessagesServiceError } from "./messages-service-error";

const MAX_CHAT_PDF_BYTES = 15 * 1024 * 1024;
const MAX_CHAT_CSV_BYTES = 10 * 1024 * 1024;
const MAX_CHAT_XLSX_BYTES = 10 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Нормализует и проверяет JSON вложения type=file (PDF, CSV или XLSX). */
export function parseAndValidateChatFileMessageContent(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new MessagesServiceError(400, "Некорректное вложение");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new MessagesServiceError(400, "Некорректное вложение");
  }
  const o = parsed as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  let name = typeof o.name === "string" ? o.name.trim().slice(0, 200) : "";
  const mime = typeof o.mime === "string" ? o.mime.trim().toLowerCase() : "";
  const size = typeof o.size === "number" && Number.isFinite(o.size) ? o.size : 0;
  if (!url) {
    throw new MessagesServiceError(400, "Во вложении нет ссылки на файл");
  }
  const urlOk =
    url.startsWith("/uploads/chat/") ||
    /^https?:\/\/[^/]+\//i.test(url);
  if (!urlOk) {
    throw new MessagesServiceError(400, "Некорректная ссылка на файл");
  }

  if (mime === "application/pdf" || mime === "application/x-pdf") {
    if (size <= 0 || size > MAX_CHAT_PDF_BYTES) {
      throw new MessagesServiceError(400, "Размер PDF не более 15 МБ");
    }
    if (!name.toLowerCase().endsWith(".pdf")) {
      name = name ? `${name}.pdf` : "document.pdf";
    }
    return JSON.stringify({
      url,
      name: name || "document.pdf",
      mime: "application/pdf",
      size,
    });
  }

  if (mime === "text/csv" || mime === "application/csv") {
    if (size <= 0 || size > MAX_CHAT_CSV_BYTES) {
      throw new MessagesServiceError(400, "Размер CSV не более 10 МБ");
    }
    if (!name.toLowerCase().endsWith(".csv")) {
      name = name ? `${name}.csv` : "table.csv";
    }
    return JSON.stringify({
      url,
      name: name || "table.csv",
      mime: "text/csv",
      size,
    });
  }

  if (mime === XLSX_MIME) {
    if (size <= 0 || size > MAX_CHAT_XLSX_BYTES) {
      throw new MessagesServiceError(400, "Размер Excel-файла не более 10 МБ");
    }
    if (!name.toLowerCase().endsWith(".xlsx")) {
      name = name ? `${name}.xlsx` : "table.xlsx";
    }
    return JSON.stringify({
      url,
      name: name || "table.xlsx",
      mime: XLSX_MIME,
      size,
    });
  }

  throw new MessagesServiceError(400, "В чате можно отправлять только PDF, CSV или XLSX");
}
