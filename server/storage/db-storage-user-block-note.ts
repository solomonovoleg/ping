/** При вставке: если заметку не передали — в строке `null` (как в исходном `addBlock`). */
export function userBlockNoteForInsert(blockNote: string | null | undefined): string | null {
  return blockNote === undefined ? null : blockNote;
}

/** Единая нормализация заметки для API (пустая строка → `null`). */
export function normalizeUserBlockNoteFromDb(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}
