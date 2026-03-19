/**
 * Per-chat translation preferences.
 * Local state in localStorage + sync to server on change.
 * By default translation is OFF; user enables it per chat.
 */
import { API, apiFetch } from "./api-base";

const CHAT_PREFIX = "ping:translate-chat:";
const LANG_KEY = "ping:translate-lang";
const EVENT_NAME = "ping:translate-change";

export const TRANSLATE_LANGUAGES = [
  { code: "ru", label: "Русский" },
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
] as const;

export type TranslateLangCode = (typeof TRANSLATE_LANGUAGES)[number]["code"];

function detectDefaultLang(): TranslateLangCode {
  if (typeof navigator === "undefined") return "ru";
  const nav = (navigator.language || "").slice(0, 2).toLowerCase();
  const found = TRANSLATE_LANGUAGES.find((l) => l.code === nav);
  return (found?.code ?? "ru") as TranslateLangCode;
}

/** Is translation enabled for this specific chat? Default: false */
export function getTranslateEnabled(chatId: string): boolean {
  if (!chatId || typeof window === "undefined") return false;
  const v = localStorage.getItem(CHAT_PREFIX + chatId);
  return v === "1" || v === "true";
}

export function setTranslateEnabled(chatId: string, enabled: boolean): void {
  if (!chatId || typeof window === "undefined") return;
  localStorage.setItem(CHAT_PREFIX + chatId, enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { chatId, enabled } }));
  syncPrefsToServer(chatId);
}

/** User's preferred target language for translations. */
export function getTranslateLang(): TranslateLangCode {
  if (typeof window === "undefined") return "ru";
  const stored = localStorage.getItem(LANG_KEY);
  if (stored && TRANSLATE_LANGUAGES.some((l) => l.code === stored)) {
    return stored as TranslateLangCode;
  }
  return detectDefaultLang();
}

export function setTranslateLang(lang: TranslateLangCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, lang);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { lang } }));
}

/** Sync current prefs to server (so WS delivery can use them). */
function syncPrefsToServer(chatId: string): void {
  const enabled = getTranslateEnabled(chatId);
  const targetLang = getTranslateLang();
  apiFetch(`${API}/chats/${chatId}/translate-prefs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, targetLang }),
  }).catch(() => {});
}

/** Sync prefs to server on chat open (ensures server knows about prefs for WS delivery). */
export function syncPrefsOnChatOpen(chatId: string): void {
  if (!chatId || typeof window === "undefined") return;
  if (!getTranslateEnabled(chatId)) return;
  syncPrefsToServer(chatId);
}
