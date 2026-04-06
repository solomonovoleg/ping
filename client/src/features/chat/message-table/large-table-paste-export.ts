import {
  MESSAGE_TABLE_MAX_CSV_BYTES,
  MESSAGE_TABLE_MAX_CSV_COLS,
  MESSAGE_TABLE_MAX_CSV_ROWS,
  MESSAGE_TABLE_MAX_INLINE_COLS,
  MESSAGE_TABLE_MAX_INLINE_ROWS,
} from "./constants";
import { gridToCsvString } from "./large-table-export-stub";
import { parsePastedGrid } from "./parse-pasted-grid";
import type { ParsedGrid } from "./types";

export type LargeTablePasteData = {
  grid: ParsedGrid;
  cols: number;
  rows: number;
  previewRows: string[][];
};

export type LargeTablePasteDataResult = { ok: true; data: LargeTablePasteData } | { ok: false; error: string };

/** Совместимость: раньше сразу возвращали готовый CSV-файл. */
export type LargeTableCsvPrep =
  | { ok: true; file: File; cols: number; rows: number; previewRows: string[][] }
  | { ok: false; error: string };

export function prepareLargeTablePasteData(plain: string): LargeTablePasteDataResult {
  const grid = parsePastedGrid(plain);
  if (!grid) {
    return { ok: false, error: "Не удалось разобрать таблицу." };
  }
  const rows = grid.rows.length;
  const cols = grid.rows[0]?.length ?? 0;
  if (rows <= MESSAGE_TABLE_MAX_INLINE_ROWS && cols <= MESSAGE_TABLE_MAX_INLINE_COLS) {
    return { ok: false, error: "Таблица помещается во встроенный вид — вставь ещё раз." };
  }
  if (rows > MESSAGE_TABLE_MAX_CSV_ROWS || cols > MESSAGE_TABLE_MAX_CSV_COLS) {
    return {
      ok: false,
      error: `Слишком много данных (макс. ${MESSAGE_TABLE_MAX_CSV_COLS} столбцов и ${MESSAGE_TABLE_MAX_CSV_ROWS} строк). Разбей на части.`,
    };
  }
  const csvProbe = "\uFEFF" + gridToCsvString(grid);
  if (csvProbe.length > MESSAGE_TABLE_MAX_CSV_BYTES) {
    return {
      ok: false,
      error: "Таблица даёт слишком тяжёлый файл (лимит ~10 МБ). Уменьши объём данных.",
    };
  }
  const previewW = Math.min(5, cols);
  const previewH = Math.min(4, rows);
  const previewRows = grid.rows.slice(0, previewH).map((r) => r.slice(0, previewW));
  return {
    ok: true,
    data: { grid, cols, rows, previewRows },
  };
}

export function buildLargeTableCsvFileFromGrid(grid: ParsedGrid): File {
  const csvBody = gridToCsvString(grid);
  const csv = "\uFEFF" + csvBody;
  if (csv.length > MESSAGE_TABLE_MAX_CSV_BYTES) {
    throw new Error("CSV превышает допустимый размер (~10 МБ).");
  }
  return new File([csv], `table-${Date.now()}.csv`, {
    type: "text/csv;charset=utf-8",
  });
}

export function prepareLargeTableCsvFromPaste(plain: string): LargeTableCsvPrep {
  const r = prepareLargeTablePasteData(plain);
  if (!r.ok) return r;
  try {
    const file = buildLargeTableCsvFileFromGrid(r.data.grid);
    return {
      ok: true,
      file,
      cols: r.data.cols,
      rows: r.data.rows,
      previewRows: r.data.previewRows,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Не удалось собрать CSV." };
  }
}
