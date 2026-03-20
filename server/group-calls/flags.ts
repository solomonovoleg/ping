/**
 * Серверный флаг модуля групповых звонков. Пока false — ничего не монтируем на HTTP/WS.
 */
export function isGroupCallsServerEnabled(): boolean {
  const v = process.env.GROUP_CALLS_ENABLED;
  if (v == null || v === "") return false;
  const n = v.trim().toLowerCase();
  return n === "1" || n === "true" || n === "yes" || n === "on";
}
