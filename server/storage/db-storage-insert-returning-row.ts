/** Drizzle `insert().returning()` обычно даёт массив; единая проверка на пустой результат. */
export function firstInsertReturningRow<T>(result: T[] | T | undefined, errorMessage: string): T {
  const rows = Array.isArray(result) ? result : [];
  const row = rows[0];
  if (!row) throw new Error(errorMessage);
  return row;
}
