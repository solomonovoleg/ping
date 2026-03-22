/**
 * Прокси к Yandex Speller API.
 * Отдельный модуль: при любом сбое (таймаут, ошибка Яндекса, сеть) возвращаем пустой массив.
 * Отправка сообщений НЕ зависит от spellcheck — это чисто подсказки при наборе.
 */
import type { Express } from "express";
import { requireAuth } from "../auth/session";

const YANDEX_SPELLER_URL = "https://speller.yandex.net/services/spellservice.json/checkText";
const REQUEST_TIMEOUT_MS = 4000;
const MAX_TEXT_LENGTH = 2000;

export type SpellError = {
  code: number;
  pos: number;
  row: number;
  col: number;
  len: number;
  word: string;
  s?: string[];
};

async function callYandexSpeller(text: string): Promise<SpellError[]> {
  const truncated = text.slice(0, MAX_TEXT_LENGTH);
  const params = new URLSearchParams({
    text: truncated,
    lang: "ru",
    options: "0",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${YANDEX_SPELLER_URL}?${params.toString()}`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timeout);
  }
}

export function registerSpellcheckRoutes(app: Express): void {
  app.post("/api/spellcheck", requireAuth, async (req, res) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (!text || text.length < 2) {
        return res.json({ errors: [] });
      }
      const errors = await callYandexSpeller(text);
      res.json({ errors });
    } catch {
      // Любая ошибка — возвращаем пусто. Пользователь продолжает печатать и отправлять как обычно.
      res.json({ errors: [] });
    }
  });
}
