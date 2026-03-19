/**
 * Hook: seamless message translation.
 *
 * Flow:
 * 1. New messages arrive from WS with translatedText/detectedLang already set (server translates before delivery).
 * 2. On chat load, bulk-fetch cached translations from server for existing messages.
 * 3. For messages that lack a translation, request one (server caches it).
 *
 * No visible loading: messages from WS arrive pre-translated; history translations load in parallel with messages.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { API, apiFetch } from "@/lib/api-base";
import type { ApiMessage } from "../types";

export interface TranslationEntry {
  translatedText: string;
  detectedLang: string;
}

export type TranslationMap = Map<string, TranslationEntry>;

const CYRILLIC_RE = /[\u0400-\u04FF]/;

function guessLang(text: string): string | null {
  const letters = text.replace(/[\s\d.,!?;:'"()\-\[\]{}@#$%^&*+=<>/\\|~`_]/g, "");
  if (!letters) return null;
  const cyr = (letters.match(/[\u0400-\u04FF]/g) || []).length;
  const lat = (letters.match(/[A-Za-z]/g) || []).length;
  const total = cyr + lat;
  if (total === 0) return null;
  if (cyr / total > 0.5) return "ru";
  if (lat / total > 0.5) return "en";
  return null;
}

function needsTranslation(text: string, targetLang: string): boolean {
  const lang = guessLang(text);
  if (!lang) return false;
  if (targetLang === "ru") return !CYRILLIC_RE.test(text) || lang !== "ru";
  return lang !== targetLang;
}

export function useMessageTranslation(
  messages: ApiMessage[],
  enabled: boolean,
  targetLang: string,
  currentUserId: string,
  chatId: string,
): {
  translations: TranslationMap;
  showOriginalIds: Set<string>;
  toggleOriginal: (messageId: string) => void;
} {
  const [translations, setTranslations] = useState<TranslationMap>(() => new Map());
  const [showOriginalIds, setShowOriginalIds] = useState<Set<string>>(() => new Set());

  const pendingRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const bulkFetchedRef = useRef<string | null>(null);

  // Bulk-fetch cached translations on chat load
  useEffect(() => {
    if (!enabled || !chatId) return;
    if (bulkFetchedRef.current === `${chatId}:${targetLang}`) return;
    bulkFetchedRef.current = `${chatId}:${targetLang}`;

    apiFetch(`${API}/chats/${chatId}/translations?targetLang=${encodeURIComponent(targetLang)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.translations || !enabledRef.current) return;
        const map = data.translations as Record<string, { translatedText: string; detectedLang: string | null }>;
        setTranslations((prev) => {
          const next = new Map(prev);
          for (const [msgId, t] of Object.entries(map)) {
            if (!next.has(msgId)) {
              next.set(msgId, { translatedText: t.translatedText, detectedLang: t.detectedLang || "auto" });
            }
          }
          return next;
        });
      })
      .catch(() => {});
  }, [enabled, chatId, targetLang]);

  // Pick up translations from WS (already on ApiMessage) + request missing ones
  useEffect(() => {
    if (!enabled) {
      if (translations.size > 0) setTranslations(new Map());
      return;
    }

    const newEntries: [string, TranslationEntry][] = [];
    const toTranslate: ApiMessage[] = [];

    for (const msg of messages) {
      if (msg.senderId === currentUserId) continue;
      if (msg.type !== "text") continue;

      // Already have translation in local state
      if (translations.has(msg.id)) continue;

      // WS delivered translation inline
      if (msg.translatedText && msg.detectedLang) {
        newEntries.push([msg.id, { translatedText: msg.translatedText, detectedLang: msg.detectedLang }]);
        continue;
      }

      // Need to request translation
      if (!pendingRef.current.has(msg.id) && needsTranslation(msg.content, targetLang)) {
        toTranslate.push(msg);
      }
    }

    if (newEntries.length > 0) {
      setTranslations((prev) => {
        const next = new Map(prev);
        for (const [id, entry] of newEntries) next.set(id, entry);
        return next;
      });
    }

    for (const msg of toTranslate) {
      pendingRef.current.add(msg.id);
      apiFetch(`${API}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, targetLang, messageId: msg.id }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          pendingRef.current.delete(msg.id);
          if (!enabledRef.current || !data?.translatedText) return;
          const entry: TranslationEntry = { translatedText: data.translatedText, detectedLang: data.detectedLang || "auto" };
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(msg.id, entry);
            return next;
          });
        })
        .catch(() => pendingRef.current.delete(msg.id));
    }
  }, [messages, enabled, targetLang, currentUserId, translations]);

  const toggleOriginal = useCallback((messageId: string) => {
    setShowOriginalIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  return { translations, showOriginalIds, toggleOriginal };
}
