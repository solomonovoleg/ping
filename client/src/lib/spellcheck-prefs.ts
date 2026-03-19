/**
 * Настройка автоисправления орфографии.
 * Глобально (в настройках) и по чату — по умолчанию включено.
 */
const STORAGE_KEY = "ping:spellcheck-enabled";
const CHAT_PREFIX = "ping:spellcheck-chat:";

export function getSpellCheckEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null || v === "1" || v === "true";
}

export function setSpellCheckEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent("ping:spellcheck-change", { detail: enabled }));
}

/** Включена ли проверка для конкретного чата. По умолчанию — да. */
export function getChatSpellCheckEnabled(chatId: string): boolean {
  if (!chatId || typeof window === "undefined") return true;
  const v = localStorage.getItem(CHAT_PREFIX + chatId);
  return v === null || v === "1" || v === "true";
}

export function setChatSpellCheckEnabled(chatId: string, enabled: boolean): void {
  if (!chatId || typeof window === "undefined") return;
  localStorage.setItem(CHAT_PREFIX + chatId, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent("ping:spellcheck-change", { detail: enabled }));
}
