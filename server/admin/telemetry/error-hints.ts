/**
 * Подсказки для админки по HTTP-статусу и тексту ошибки (без привязки к Express).
 */

export function telemetryHintsForHttpError(status: number, durationMs: number, detail: string | null): string[] {
  const hints: string[] = [];
  const d = (detail || "").toLowerCase();
  if (status === 429) {
    hints.push("Лимит запросов (API shield). Проверьте настройки «Строгий режим» в админке → Операции.");
  }
  if (status >= 500) {
    if (d.includes("database") || d.includes("postgres") || d.includes("econnrefused")) {
      hints.push("Похоже на проблему с PostgreSQL или DATABASE_URL.");
    }
    if (d.includes("timeout") || durationMs > 25_000) {
      hints.push("Таймаут: перегрузка сервера, медленный диск или долгий SQL — смотрите логи процесса Node.");
    }
    if (d.includes("s3") || d.includes("upload")) {
      hints.push("Возможна ошибка загрузки в объектное хранилище (S3) или нехватка места.");
    }
    if (hints.length === 0) {
      hints.push("Смотрите стек в консоли сервера (pm2 logs) и X-Request-Id в ответе клиента.");
    }
  }
  if (status === 401 || status === 403) {
    hints.push("Ожидаемо при истёкшей сессии или недостаточных правах; не всегда инцидент.");
  }
  if (status === 404) {
    hints.push("Ресурс не найден или неверный URL; часто клиентский запрос, а не падение сервера.");
  }
  return hints;
}
