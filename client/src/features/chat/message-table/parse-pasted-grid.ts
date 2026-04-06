import {
  MESSAGE_TABLE_MAX_CELL_CHARS,
  MESSAGE_TABLE_MAX_JSON_CHARS,
  MESSAGE_TABLE_MIN_COLS,
  MESSAGE_TABLE_MIN_ROWS,
} from "./constants";
import type { ParsedGrid, TableDelimiter } from "./types";

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function trimTrailingEmpty(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.trim() === "") end -= 1;
  return lines.slice(0, end);
}

function splitByDelimiter(line: string, delimiter: TableDelimiter): string[] {
  if (delimiter === "tab") return line.split("\t");
  if (delimiter === "multi_space") {
    return line.split(/\s{2,}/u).map((c) => c.trim());
  }
  const d = delimiter === "semicolon" ? ";" : ",";
  return line.split(d);
}

function padRow(row: string[], width: number): string[] {
  const next = row.slice(0, width);
  while (next.length < width) next.push("");
  return next;
}

function scoreDelimiter(lines: string[], delimiter: TableDelimiter): { score: number; width: number } | null {
  if (lines.length < MESSAGE_TABLE_MIN_ROWS) return null;
  const splits = lines.map((l) => splitByDelimiter(l, delimiter));
  const widths = splits.map((r) => r.length);
  const width = Math.max(...widths);
  if (width < MESSAGE_TABLE_MIN_COLS) return null;
  const uniform = splits.every((r) => r.length === width);
  if (!uniform) {
    const almost = splits.every((r) => r.length <= width);
    if (!almost) return null;
  }
  const variance = splits.reduce((acc, r) => acc + Math.abs(width - r.length), 0);
  return { score: lines.length * width - variance, width };
}

function pickDelimiter(lines: string[]): { delimiter: TableDelimiter; width: number } | null {
  const candidates: TableDelimiter[] = ["tab", "semicolon", "comma"];
  let best: { delimiter: TableDelimiter; width: number; score: number } | null = null;
  for (const delimiter of candidates) {
    const row = scoreDelimiter(lines, delimiter);
    if (!row) continue;
    if (!best || row.score > best.score) {
      best = { delimiter, width: row.width, score: row.score };
    }
  }
  if (!best) return null;
  if (best.delimiter !== "tab") {
    const tabRow = scoreDelimiter(lines, "tab");
    if (tabRow && tabRow.score >= best.score) {
      return { delimiter: "tab", width: tabRow.width };
    }
  }
  return { delimiter: best.delimiter, width: best.width };
}

function normalizeRows(raw: string[][], width: number): string[][] {
  return raw.map((r) => padRow(r, width));
}

/**
 * Одна строка из Excel / Sheets: в буфере часто одна линия с `\t` между ячейками (раньше требовали ≥2 строк — не срабатывало).
 */
function tryParseSingleRowTsv(line: string): ParsedGrid | null {
  if (!line.includes("\t")) return null;
  const parts = line.split("\t").map((c) => c.replace(/\u00a0/g, " ").trim());
  if (parts.length < MESSAGE_TABLE_MIN_COLS) return null;
  if (!parts.some((p) => p.length > 0)) return null;
  if (parts.some((c) => c.length > MESSAGE_TABLE_MAX_CELL_CHARS)) return null;
  return { delimiter: "tab", rows: [parts] };
}

/** Строки похожи на код (отсекаем ложные таблицы). */
function looksLikeIndentedCodeBlock(lines: string[]): boolean {
  if (lines.length < 3) return false;
  const codeish = lines.filter((l) => /^\s{2,}(def |class |import |from |const |let |var |function |#include|package )/.test(l));
  return codeish.length >= Math.ceil(lines.length * 0.4);
}

/**
 * Разбор вставленного текста как прямоугольной сетки (TSV / ; / ,).
 * Этап 1 — ядро модуля.
 */
export function parsePastedGrid(text: string): ParsedGrid | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MESSAGE_TABLE_MAX_JSON_CHARS) return null;

  const lines = trimTrailingEmpty(splitLines(trimmed).filter((l) => l.length > 0));
  if (lines.length === 0) return null;

  if (lines.length === 1) {
    const oneRow = tryParseSingleRowTsv(lines[0]!);
    if (oneRow) return oneRow;
    return null;
  }

  if (lines.length < MESSAGE_TABLE_MIN_ROWS) return null;
  if (looksLikeIndentedCodeBlock(lines)) return null;

  let picked = pickDelimiter(lines);
  if (!picked) {
    const row = scoreDelimiter(lines, "multi_space");
    if (row) picked = { delimiter: "multi_space", width: row.width };
  }
  if (!picked) return null;

  const splits = lines.map((l) => splitByDelimiter(l, picked.delimiter));
  const width = picked.width;
  const rows = normalizeRows(splits, width);

  if (rows.some((r) => r.some((c) => c.length > MESSAGE_TABLE_MAX_CELL_CHARS))) return null;

  return { delimiter: picked.delimiter, rows };
}
