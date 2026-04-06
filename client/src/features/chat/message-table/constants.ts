/** Лимиты вставки таблицы в чат (этап 1 — контракт модуля). */
export const MESSAGE_TABLE_MIN_ROWS = 2;
export const MESSAGE_TABLE_MIN_COLS = 2;

/** Максимум для inline в пузыре (как договаривались). */
export const MESSAGE_TABLE_MAX_INLINE_COLS = 5;
export const MESSAGE_TABLE_MAX_INLINE_ROWS = 20;

/** Защита от гигантских ячеек и JSON в БД. */
export const MESSAGE_TABLE_MAX_CELL_CHARS = 2000;
export const MESSAGE_TABLE_MAX_JSON_CHARS = 48_000;

/** Лимиты CSV при вставке большой таблицы (сервер: 10 МБ). */
export const MESSAGE_TABLE_MAX_CSV_ROWS = 8_000;
export const MESSAGE_TABLE_MAX_CSV_COLS = 120;
export const MESSAGE_TABLE_MAX_CSV_BYTES = 9.5 * 1024 * 1024;

/** Язык fenced-блока: ```table\n...\n``` совпадает с `parseCodeSegments`. */
export const MESSAGE_TABLE_FENCE_LANG = "table";
