/**
 * Hook: seamless message translation.
 *
 * Flow:
 * 1. New messages arrive from WS with translatedText/detectedLang already set (server translates before delivery).
 * 2. On chat load, bulk-fetch cached translations from server for existing messages.
 * 3. For messages that lack a translation, request one (server caches it) via a bounded queue (no burst).
 *
 * При смене текста сообщения (редактирование) кэш перевода сбрасывается и запрашивается заново.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { API, apiFetch } from "@/lib/api-base";
import type { ApiMessage } from "../types";

export interface TranslationEntry {
  translatedText: string;
  detectedLang: string;
}

export type TranslationMap = Map<string, TranslationEntry>;

const TRANSLATE_FETCH_CONCURRENCY = 4;

function translateSourceText(msg: ApiMessage): string {
  if (msg.type === "text") return msg.content.trim();
  if (msg.type === "voice" || msg.type === "video_note") return (msg.transcript ?? "").trim();
  return "";
}

export function useMessageTranslation(
  messages: ApiMessage[],
  enabled: boolean,
  targetLang: string,
  currentUserId: string,
  chatId: string,
): {
  translations: TranslationMap;
  /** Сообщения, для которых сейчас идёт догрузка перевода по REST */
  translationPendingIds: ReadonlySet<string>;
} {
  const [translations, setTranslations] = useState<TranslationMap>(() => new Map());
  const [translationPendingIds, setTranslationPendingIds] = useState(() => new Set<string>());

  const pendingRef = useRef<Set<string>>(new Set());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const targetLangRef = useRef(targetLang);
  targetLangRef.current = targetLang;
  const bulkFetchedRef = useRef<string | null>(null);
  const sourceByMessageIdRef = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<ApiMessage[]>([]);
  const activeRef = useRef(0);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const pumpRef = useRef<() => void>(() => {});

  const pump = useCallback(() => {
    while (activeRef.current < TRANSLATE_FETCH_CONCURRENCY && queueRef.current.length > 0) {
      const msg = queueRef.current.shift()!;
      activeRef.current++;
      const id = msg.id;
      const langAtSend = targetLangRef.current;
      const text = translateSourceText(msg);
      setTranslationPendingIds((prev) => new Set(prev).add(id));
      apiFetch(`${API}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang: langAtSend, messageId: id, chatId: chatIdRef.current }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          pendingRef.current.delete(id);
          if (!enabledRef.current || targetLangRef.current !== langAtSend || !data?.translatedText) return;
          const entry: TranslationEntry = { translatedText: data.translatedText, detectedLang: data.detectedLang || "auto" };
          setTranslations((prev) => {
            const next = new Map(prev);
            next.set(id, entry);
            return next;
          });
        })
        .catch(() => {
          pendingRef.current.delete(id);
        })
        .finally(() => {
          activeRef.current--;
          setTranslationPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          pumpRef.current();
        });
    }
  }, []);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  // Смена чата или целевого языка — старые строки в Map относятся к другому targetLang и ломают выбор (например EN вместо tt).
  useEffect(() => {
    bulkFetchedRef.current = null;
    setTranslations(new Map());
    pendingRef.current.clear();
    queueRef.current = [];
    sourceByMessageIdRef.current.clear();
    setTranslationPendingIds(new Set());
  }, [chatId, targetLang]);

  // Bulk-fetch cached translations on chat load
  useEffect(() => {
    if (!enabled || !chatId) return;
    if (bulkFetchedRef.current === `${chatId}:${targetLang}`) return;
    bulkFetchedRef.current = `${chatId}:${targetLang}`;

    const bulkKey = `${chatId}:${targetLang}`;
    apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/translations?targetLang=${encodeURIComponent(targetLang)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (bulkFetchedRef.current !== bulkKey || !data?.translations || !enabledRef.current) return;
        const map = data.translations as Record<string, { translatedText: string; detectedLang: string | null }>;
        setTranslations(() => {
          const next = new Map<string, TranslationEntry>();
          for (const [msgId, t] of Object.entries(map)) {
            next.set(msgId, { translatedText: t.translatedText, detectedLang: t.detectedLang || "auto" });
          }
          return next;
        });
      })
      .catch(() => {});
  }, [enabled, chatId, targetLang]);

  // Pick up translations from WS (already on ApiMessage) + enqueue missing ones
  useEffect(() => {
    if (!enabled) {
      queueRef.current = [];
      if (translations.size > 0) setTranslations(new Map());
      setTranslationPendingIds(new Set());
      return;
    }

    const messageIds = new Set(messages.map((m) => m.id));
    for (const id of [...sourceByMessageIdRef.current.keys()]) {
      if (!messageIds.has(id)) sourceByMessageIdRef.current.delete(id);
    }

    const invalidatedIds: string[] = [];
    for (const msg of messages) {
      if (msg.senderId === currentUserId) continue;
      const source = translateSourceText(msg);
      const prev = sourceByMessageIdRef.current.get(msg.id);
      if (prev !== undefined && prev !== source) invalidatedIds.push(msg.id);
      sourceByMessageIdRef.current.set(msg.id, source);
    }

    if (invalidatedIds.length > 0) {
      const inv = new Set(invalidatedIds);
      queueRef.current = queueRef.current.filter((m) => !inv.has(m.id));
      for (const id of invalidatedIds) pendingRef.current.delete(id);
      setTranslations((prev) => {
        const next = new Map(prev);
        let changed = false;
        for (const id of invalidatedIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
      setTranslationPendingIds((prev) => {
        const next = new Set(prev);
        for (const id of invalidatedIds) next.delete(id);
        return next;
      });
    }

    const newEntries: [string, TranslationEntry][] = [];
    const toEnqueue: ApiMessage[] = [];

    for (const msg of messages) {
      if (msg.senderId === currentUserId) continue;
      const sourceText = translateSourceText(msg);
      if (!sourceText) continue;

      if (translations.has(msg.id)) {
        pendingRef.current.delete(msg.id);
        queueRef.current = queueRef.current.filter((m) => m.id !== msg.id);
        continue;
      }

      const inline = msg.translatedText?.trim();
      if (inline && msg.translateTargetLang === targetLang) {
        pendingRef.current.delete(msg.id);
        queueRef.current = queueRef.current.filter((m) => m.id !== msg.id);
        newEntries.push([msg.id, { translatedText: inline, detectedLang: msg.detectedLang || "auto" }]);
        continue;
      }

      if (!pendingRef.current.has(msg.id)) {
        pendingRef.current.add(msg.id);
        toEnqueue.push(msg);
      }
    }

    if (newEntries.length > 0) {
      setTranslationPendingIds((prev) => {
        const next = new Set(prev);
        for (const [id] of newEntries) next.delete(id);
        return next;
      });
      setTranslations((prev) => {
        const next = new Map(prev);
        for (const [id, entry] of newEntries) next.set(id, entry);
        return next;
      });
    }

    if (toEnqueue.length > 0) {
      queueRef.current.push(...toEnqueue);
      pumpRef.current();
    }
  }, [messages, enabled, targetLang, currentUserId, translations, pump]);

  return { translations, translationPendingIds };
}
