/**
 * Контракт NLU: сервер возвращает структурированное намерение.
 * Расширяйте intent по мере появления команд.
 */
export type PingokMicroIntent =
  | "unknown"
  | "find"
  | "plan"
  | "task"
  | "call"
  | "message"
  | "remind"
  | "show";

export type PingokMicroParseRequest = {
  text: string;
};

export type PingokMicroParseResponse = {
  intent: PingokMicroIntent;
  /** Текст после удаления фразы пробуждения */
  commandText: string;
  /** Короткий ответ пользователю (пока заглушка) */
  reply: string;
  slots: Record<string, string | undefined>;
};

/** Фразы пробуждения (русский STT может отдавать варианты — нормализуем на клиенте). */
export const PINGOK_WAKE_PHRASES: readonly string[] = [
  "эй пинг",
  "слушай пинг",
  "пинг слушай",
  "окей пинг",
];
