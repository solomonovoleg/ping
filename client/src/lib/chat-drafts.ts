/**
 * Модуль «Черновики сообщений в чате» (п.9 VS_TELEGRAM_20).
 * Один файл: хранение черновика по chatId в localStorage, подстановка при открытии чата.
 */

const PREFIX = "ping_chat_draft:";
const MAX_LENGTH = 4096;
const MAX_KEYS = 100;

function key(chatId: string): string {
  return PREFIX + chatId;
}

function isDraftKey(k: string): boolean {
  return k.startsWith(PREFIX);
}

/** Вернуть черновик для чата или пустую строку. */
export function getDraft(chatId: string): string {
  if (!chatId || typeof localStorage === "undefined") return "";
  try {
    const raw = localStorage.getItem(key(chatId));
    if (raw == null) return "";
    const s = String(raw).slice(0, MAX_LENGTH);
    return s;
  } catch {
    return "";
  }
}

/** Сохранить черновик. Пустой текст удаляет черновик. */
export function setDraft(chatId: string, text: string): void {
  if (!chatId || typeof localStorage === "undefined") return;
  try {
    const k = key(chatId);
    const val = text.trim();
    if (!val) {
      localStorage.removeItem(k);
      return;
    }
    localStorage.setItem(k, val.slice(0, MAX_LENGTH));
  } catch {
    // ignore
  }
}

/** Удалить черновик для чата. */
export function clearDraft(chatId: string): void {
  if (!chatId || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key(chatId));
  } catch {
    // ignore
  }
}

/** Оставить только последние MAX_KEYS черновиков (по дате записи не храним, удаляем лишние по алфавиту ключей). */
export function pruneDrafts(): void {
  if (typeof localStorage === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isDraftKey(k)) keys.push(k);
    }
    if (keys.length <= MAX_KEYS) return;
    keys.sort();
    for (let i = 0; i < keys.length - MAX_KEYS; i++) {
      localStorage.removeItem(keys[i]);
    }
  } catch {
    // ignore
  }
}
