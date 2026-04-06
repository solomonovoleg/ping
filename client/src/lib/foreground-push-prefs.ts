/**
 * Дублирование текста входящего push тостом, пока приложение на экране (веб и Android).
 * На iOS баннер в foreground даёт система — отдельный тост не показываем.
 */

const STORAGE_KEY = "ping:foreground-push-toast";

export const FOREGROUND_PUSH_TOAST_CHANGE = "ping:foreground-push-toast-change";

/** По умолчанию включено — как раньше на вебе. */
export function getForegroundPushToastEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null || v === "1" || v === "true";
}

export function setForegroundPushToastEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent(FOREGROUND_PUSH_TOAST_CHANGE, { detail: enabled }));
}
