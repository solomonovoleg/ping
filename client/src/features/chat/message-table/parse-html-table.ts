import { MESSAGE_TABLE_MAX_JSON_CHARS, MESSAGE_TABLE_MIN_COLS, MESSAGE_TABLE_MIN_ROWS } from "./constants";
import type { ParsedGrid } from "./types";

const MAX_HTML_BYTES = Math.min(MESSAGE_TABLE_MAX_JSON_CHARS * 6, 512_000);

function cellPlainText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

function expandColspan(text: string, colspan: number): string[] {
  const n = Math.min(20, Math.max(1, colspan));
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(i === 0 ? text : "");
  return out;
}

function extractRow(tr: Element): string[] {
  const cells: string[] = [];
  for (const cell of Array.from(tr.children)) {
    const tag = cell.tagName;
    if (tag !== "TH" && tag !== "TD") continue;
    const text = cellPlainText(cell);
    const cs = parseInt(cell.getAttribute("colspan") || "1", 10) || 1;
    cells.push(...expandColspan(text, cs));
  }
  return cells;
}

function extractRowsFromTable(table: Element): string[][] {
  const rows: string[][] = [];
  for (const tr of table.querySelectorAll("tr")) {
    const r = extractRow(tr);
    if (r.length) rows.push(r);
  }
  return rows;
}

function normalizeGrid(rows: string[][]): string[][] | null {
  if (rows.length === 0) return null;
  const w = Math.max(...rows.map((r) => r.length), 0);
  if (w < MESSAGE_TABLE_MIN_COLS) return null;
  /** Excel: одна строка × несколько колонок — валидная таблица. */
  if (rows.length < MESSAGE_TABLE_MIN_ROWS && rows.length !== 1) return null;
  return rows.map((r) => {
    const x = r.slice(0, w);
    while (x.length < w) x.push("");
    return x;
  });
}

/**
 * Таблица из буфера (Excel, Google Sheets, веб): часто есть `text/html` с `<table>`, а `text/plain` — просто абзацы.
 */
export function parsePastedHtmlTable(html: string): ParsedGrid | null {
  const trimmed = html.trim();
  if (!trimmed || trimmed.length > MAX_HTML_BYTES) return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(trimmed, "text/html");
  } catch {
    return null;
  }

  const tables = Array.from(doc.querySelectorAll("table"));
  if (tables.length === 0) return null;

  let best: string[][] | null = null;
  let bestScore = 0;

  for (const table of tables) {
    const raw = extractRowsFromTable(table);
    const norm = normalizeGrid(raw);
    if (!norm) continue;
    const score = norm.length * Math.max(...norm.map((r) => r.length));
    if (score > bestScore) {
      bestScore = score;
      best = norm;
    }
  }

  if (!best) return null;

  return { delimiter: "tab", rows: best };
}
