/**
 * Модуль проверки орфографии через Yandex Speller (прокси на нашем сервере).
 * При любом сбое API возвращаем пустой массив — отправка сообщений не зависит от spellcheck.
 */
import { API, apiFetch } from "./api-base";

export type SpellError = {
  code: number;
  pos: number;
  row: number;
  col: number;
  len: number;
  word: string;
  s?: string[];
};

export type SpellCheckResult = { errors: SpellError[] };

const CYRILLIC_RE = /[\u0400-\u04FF]/;

/** Вызов API. При ошибке возвращает пустой массив — не бросает исключение. */
export async function checkSpelling(text: string): Promise<SpellError[]> {
  if (!text || text.trim().length < 2) return [];
  if (!CYRILLIC_RE.test(text)) return [];
  try {
    const res = await apiFetch(`${API}/spellcheck`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as SpellCheckResult;
    return Array.isArray(data?.errors) ? data.errors : [];
  } catch {
    return [];
  }
}
