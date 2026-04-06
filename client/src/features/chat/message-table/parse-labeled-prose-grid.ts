import { MESSAGE_TABLE_MIN_ROWS } from "./constants";
import type { ParsedGrid } from "./types";

/**
 * Текст из заметок / планов: строки «Пятница, 06.03.2026:» и следующие абзацы без двоеточия
 * склеиваются в две колонки [заголовок, текст]. Не срабатывает на TSV (есть табы).
 */
export function parseLabeledProseAsTwoColumnGrid(text: string): ParsedGrid | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("\t")) return null;

  const raw = trimmed.replace(/\r\n/g, "\n").split("\n");
  const rows: string[][] = [];
  let cur: [string, string] | null = null;

  for (let line of raw) {
    line = line.trim();
    if (!line) continue;

    const m = line.match(/^([^:\n]{2,200}):\s*(.*)$/);
    if (m) {
      const label = m[1]!.trim();
      const rest = m[2]!.trim();
      if (cur) rows.push([cur[0], cur[1]]);
      cur = [label, rest];
    } else if (cur) {
      cur[1] = cur[1] ? `${cur[1]} ${line}` : line;
    }
  }
  if (cur) rows.push([cur[0], cur[1]]);

  if (rows.length < MESSAGE_TABLE_MIN_ROWS) return null;

  const avgLen = rows.reduce((n, r) => n + r[0].length + r[1].length, 0) / rows.length;
  if (avgLen > 800) return null;

  return { delimiter: "tab", rows };
}
