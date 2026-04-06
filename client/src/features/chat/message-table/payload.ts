import {
  MESSAGE_TABLE_FENCE_LANG,
  MESSAGE_TABLE_MAX_INLINE_COLS,
  MESSAGE_TABLE_MAX_INLINE_ROWS,
  MESSAGE_TABLE_MAX_JSON_CHARS,
} from "./constants";
import type { ChatTablePayloadV1, ParsedGrid, TablePasteResult } from "./types";
import { parsePastedHtmlTable } from "./parse-html-table";
import { parseLabeledProseAsTwoColumnGrid } from "./parse-labeled-prose-grid";
import { parsePastedGrid } from "./parse-pasted-grid";

function payloadJson(payload: ChatTablePayloadV1): string {
  return JSON.stringify(payload);
}

/** Сообщение для вставки в композер: fenced-блок, совместимый с `parseCodeSegments`. */
export function buildTableFenceFromPayload(payload: ChatTablePayloadV1): string {
  const body = payloadJson(payload);
  return `\`\`\`${MESSAGE_TABLE_FENCE_LANG}\n${body}\n\`\`\``;
}

export function parseTablePayloadFromFenceBody(body: string): ChatTablePayloadV1 | null {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const p = JSON.parse(trimmed) as unknown;
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    if (o.v !== 1) return null;
    if (
      o.delimiter !== "tab" &&
      o.delimiter !== "comma" &&
      o.delimiter !== "semicolon" &&
      o.delimiter !== "multi_space"
    )
      return null;
    if (!Array.isArray(o.rows)) return null;
    const rows = o.rows.filter(Array.isArray) as unknown[][];
    const strRows: string[][] = rows.map((r) =>
      r.map((c) => (typeof c === "string" ? c : c == null ? "" : String(c))),
    );
    if (strRows.length === 0) return null;
    const w = Math.max(...strRows.map((r) => r.length));
    if (w < 1) return null;
    const norm = strRows.map((r) => {
      const x = r.slice(0, w);
      while (x.length < w) x.push("");
      return x;
    });
    return { v: 1, delimiter: o.delimiter as ChatTablePayloadV1["delimiter"], rows: norm };
  } catch {
    return null;
  }
}

/** Текст для буфера обмена (Excel/Sheets снова вставят сеткой). */
export function tablePayloadToDelimitedText(payload: ChatTablePayloadV1): string {
  const sep =
    payload.delimiter === "tab" || payload.delimiter === "multi_space"
      ? "\t"
      : payload.delimiter === "semicolon"
        ? ";"
        : ",";
  return payload.rows.map((row) => row.join(sep)).join("\n");
}

function finalizeGridToPasteResult(grid: ParsedGrid): TablePasteResult {
  const h = grid.rows.length;
  const w = grid.rows[0]?.length ?? 0;
  if (h > MESSAGE_TABLE_MAX_INLINE_ROWS || w > MESSAGE_TABLE_MAX_INLINE_COLS) {
    return { ok: false, reason: "too_large" };
  }

  const payload: ChatTablePayloadV1 = {
    v: 1,
    delimiter: grid.delimiter,
    rows: grid.rows,
  };
  const fence = buildTableFenceFromPayload(payload);
  if (fence.length > MESSAGE_TABLE_MAX_JSON_CHARS) return { ok: false, reason: "unsafe_size" };

  return { ok: true, fence, rows: payload.rows.length, cols: payload.rows[0]?.length ?? 0 };
}

/**
 * Этап 4 — точка входа для вставки из буфера (только text/plain).
 */
export function tryBuildTablePasteFromPlainText(clipboard: string): TablePasteResult {
  const grid = parsePastedGrid(clipboard);
  if (!grid) return { ok: false, reason: "not_grid" };
  return finalizeGridToPasteResult(grid);
}

/**
 * Вставка из буфера: сначала TSV/CSV из plain, иначе `<table>` из `text/html` (Sheets/Excel/страницы).
 */
export function tryBuildTablePasteFromClipboard(plain: string, html: string): TablePasteResult {
  const fromPlain = parsePastedGrid(plain);
  if (fromPlain) return finalizeGridToPasteResult(fromPlain);

  const fromHtml = parsePastedHtmlTable(html);
  if (fromHtml) return finalizeGridToPasteResult(fromHtml);

  const fromProse = parseLabeledProseAsTwoColumnGrid(plain);
  if (!fromProse) return { ok: false, reason: "not_grid" };

  return finalizeGridToPasteResult(fromProse);
}

const TABLE_FENCE_BODY_RE = /```table\s*\n([\s\S]*?)```/i;

/** Однострочное превью для списков чатов / пушей (без парса всего текста). */
export function getChatTableListPreviewLine(fullContent: string): string | null {
  const m = TABLE_FENCE_BODY_RE.exec(fullContent);
  if (!m) return null;
  const payload = parseTablePayloadFromFenceBody(m[1]!);
  if (!payload?.rows.length) return "Таблица";
  const cols = payload.rows[0]!.length;
  const rows = payload.rows.length;
  return `Таблица ${cols}×${rows}`;
}
