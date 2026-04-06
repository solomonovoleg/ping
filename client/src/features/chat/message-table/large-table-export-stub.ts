import type { ParsedGrid } from "./types";

/**
 * Этап 5 (заготовка): экспорт большой таблицы в CSV + отправка как `file`.
 * Пока только утилита без привязки к upload.
 */
export function gridToCsvString(grid: ParsedGrid): string {
  const esc = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const d =
    grid.delimiter === "tab" || grid.delimiter === "multi_space"
      ? "\t"
      : grid.delimiter === "semicolon"
        ? ";"
        : ",";
  return grid.rows.map((row) => row.map((c) => esc(c)).join(d)).join("\n");
}

export function isGridOverInlineLimit(rows: number, cols: number, maxR: number, maxC: number): boolean {
  return rows > maxR || cols > maxC;
}
