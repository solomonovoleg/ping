/** `multi_space` — колонки разделены 2+ пробельными символами (вставка из заметок/чата без табов). */
export type TableDelimiter = "tab" | "comma" | "semicolon" | "multi_space";

/** Тело fenced-блока `table`: хранится как JSON в content сообщения. */
export type ChatTablePayloadV1 = {
  v: 1;
  delimiter: TableDelimiter;
  rows: string[][];
};

export type ParsedGrid = {
  delimiter: TableDelimiter;
  rows: string[][];
};

export type TablePasteResult =
  | { ok: true; fence: string; rows: number; cols: number }
  | { ok: false; reason: "not_grid" | "too_large" | "unsafe_size" };

export type MessageTablePhase = {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  summary: string;
  done: boolean;
};

/** Lang в ```table — совпадает с `parseCodeSegments`. */
export type TableFenceLang = "table";
