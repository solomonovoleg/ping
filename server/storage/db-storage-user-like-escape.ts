/** Экранирование фрагмента под ILIKE: `%` и `_` остаются литеральными. */
export function escapeSqlLikeUserSearch(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
