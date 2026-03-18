/**
 * Хук чата с ИИ: загрузка истории, отправка, подгрузка старых сообщений.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { getAiMessages, sendAiMessage, type AiChatMessage } from "@/lib/ai-chat";

const PAGE_SIZE = 20;

export function useAiChat() {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (beforeId?: string | null) => {
    try {
      if (beforeId) setLoadMoreLoading(true);
      else setLoading(true);
      setError(null);
      const list = await getAiMessages({ limit: PAGE_SIZE, before: beforeId ?? undefined });
      if (beforeId) {
        setMessages((prev) => [...list, ...prev]);
        setHasMore(list.length >= PAGE_SIZE);
      } else {
        setMessages(list);
        setHasMore(list.length >= PAGE_SIZE);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить историю");
    } finally {
      setLoading(false);
      setLoadMoreLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    const first = messages[0];
    if (!first || loadMoreLoading || !hasMore) return;
    load(first.id);
  }, [messages, loadMoreLoading, hasMore, load]);

  const send = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim() || sending) return false;
    setSending(true);
    try {
      const { userMessage, assistantMessage } = await sendAiMessage(content.trim());
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      return true;
    } catch {
      return false;
    } finally {
      setSending(false);
    }
  }, [sending]);

  return {
    messages,
    loading,
    error,
    sending,
    loadMoreLoading,
    hasMore,
    loadMore,
    send,
    scrollContainerRef,
    messagesEndRef,
    refetch: () => load(),
  };
}
