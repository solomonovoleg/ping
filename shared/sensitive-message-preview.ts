/**
 * Только для коротких превью (список чатов, поиск): не показывать очевидные секреты и конфиг.
 * Текст сообщения внутри чата не меняется.
 */
export const CHAT_PREVIEW_SENSITIVE_PLACEHOLDER = "Сообщение";

/**
 * Возвращает нейтральную подпись, если строка похожа на env/DSN/токены/админ-пароль.
 */
export function redactChatPreviewIfSensitive(raw: string): string {
  return shouldRedactChatPreviewText(raw) ? CHAT_PREVIEW_SENSITIVE_PLACEHOLDER : raw;
}

export function shouldRedactChatPreviewText(raw: string): boolean {
  const s = raw;
  if (!s.trim()) return false;

  if (/(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis|amqp):\/\//i.test(s)) return true;
  if (/\bjdbc:/i.test(s)) return true;

  if (/\bDATABASE_URL\b/i.test(s)) return true;
  if (/\b(DB|DATABASE|POSTGRES|MYSQL|MONGO|MONGODB|REDIS)_(URL|URI|DSN|PASSWORD|PASSWD)\b/i.test(s))
    return true;

  if (/BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/.test(s)) return true;

  if (/\/admin\b/i.test(s) && /\b(пароль|password|passwd|pwd)\b/i.test(s)) return true;

  if (/\bBearer\s+[A-Za-z0-9._+\/-]{20,}\b/.test(s)) return true;
  if (/\bsk-[A-Za-z0-9]{20,}\b/.test(s)) return true;
  if (/\bAIza[0-9A-Za-z_-]{30,}\b/.test(s)) return true;

  if (/\b(API_KEY|APIKEY|SECRET_KEY|AUTH_TOKEN|ACCESS_TOKEN)\b\s*[=:]\s*\S{8,}/i.test(s)) return true;

  if (/=[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(s)) return true;

  if (/^[A-Z][A-Z0-9_]{1,48}=\S{12,}$/m.test(s)) return true;

  return false;
}
