/**
 * Единый текст ошибки для тостов и логов (без раскрытия внутренних деталей в проде).
 */

export function getUserFacingApiErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Не удалось выполнить запрос";
}

export async function getUserFacingMessageFromResponse(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    if (typeof data.message === "string" && data.message.trim()) return data.message.trim();
  } catch {
    /* ignore */
  }
  if (res.status >= 500) return "Сервер временно недоступен";
  if (res.status === 401 || res.status === 403) return "Нет доступа. Войдите снова.";
  return `Ошибка ${res.status}`;
}
