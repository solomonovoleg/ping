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
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "ru", label: "Русский" },
  { code: "es", label: "Español" },
  { code: "tt", label: "Татарский (татарча)" },
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

function syncMessageTranslateLocaleToServer(locale: TranslateLangCode): void {
  apiFetch(`${API}/me/message-translate-locale`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  }).catch(() => {});
}

export function setTranslateLang(lang: TranslateLangCode): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LANG_KEY, lang);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { lang } }));
  syncMessageTranslateLocaleToServer(lang);
  syncAllEnabledChatPrefsToServer();
}

/** Ответ GET /api/chats/:id/translate-prefs */
export type ServerTranslatePrefs = {
  enabled: boolean;
  targetLang: string;
  dmMultilingual: boolean;
};

/**
 * Применить ответ сервера после смены режима или при открытии чата с мультиязычным DM.
 * Глобальный язык (LANG_KEY) меняем только в режиме dmMultilingual, чтобы не сбрасывать язык при обычных чатах.
 */
export function applyTranslatePrefsAfterServer(chatId: string, data: ServerTranslatePrefs): void {
  if (!chatId || typeof window === "undefined") return;
  if (data.dmMultilingual) {
    const langOk = TRANSLATE_LANGUAGES.some((l) => l.code === data.targetLang);
    const lang = (langOk ? data.targetLang : detectDefaultLang()) as TranslateLangCode;
    localStorage.setItem(CHAT_PREFIX + chatId, "1");
    localStorage.setItem(LANG_KEY, lang);
    syncMessageTranslateLocaleToServer(lang);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { chatId, enabled: true, lang } }));
    return;
  }
  localStorage.setItem(CHAT_PREFIX + chatId, data.enabled ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { chatId, enabled: data.enabled } }));
}

/** Sync current prefs to server (so WS delivery can use them). */
function syncPrefsToServer(chatId: string): void {
  const enabled = getTranslateEnabled(chatId);
  const targetLang = getTranslateLang();
  apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/translate-prefs`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled, targetLang }),
  }).catch(() => {});
}

/** После смены глобального языка — обновить prefs на сервере во всех чатах с включённым переводом (иначе WS шлёт на старый targetLang). */
function syncAllEnabledChatPrefsToServer(): void {
  if (typeof window === "undefined") return;
  const prefix = CHAT_PREFIX;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const v = localStorage.getItem(key);
    if (v !== "1" && v !== "true") continue;
    const chatId = key.slice(prefix.length);
    if (chatId) syncPrefsToServer(chatId);
  }
}

/** Sync prefs to server on chat open (ensures server knows about prefs for WS delivery). */
export function syncPrefsOnChatOpen(chatId: string): void {
  if (!chatId || typeof window === "undefined") return;
  if (!getTranslateEnabled(chatId)) return;
  syncPrefsToServer(chatId);
}
