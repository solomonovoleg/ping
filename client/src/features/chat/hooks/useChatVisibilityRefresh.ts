/**
 * При возврате на вкладку: отметить чат прочитанным и обновить данные чата.
 */
import { useEffect, useRef } from "react";
import { API, apiFetch } from "@/lib/api-base";
import type { ApiChat } from "../types";

export function useChatVisibilityRefresh(chatId: string, currentChatIdRef: { current: string }, setChat: (c: ApiChat | null) => void) {
  const readAndRefreshRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readAndRefreshRetryScheduledRef = useRef(false);

  useEffect(() => {
    const doReadAndRefresh = (isRetry = false) => {
      if (!chatId) return;
      if (isRetry) readAndRefreshRetryScheduledRef.current = false;
      const base = `${API}/chats/${encodeURIComponent(chatId)}`;
      const scheduleRetry = () => {
        if (readAndRefreshRetryScheduledRef.current) return;
        readAndRefreshRetryScheduledRef.current = true;
        readAndRefreshRetryRef.current = setTimeout(() => doReadAndRefresh(true), 2500);
      };
      apiFetch(`${base}/read`, { method: "PUT" }).catch(() => scheduleRetry());
      apiFetch(base)
        .then((r) => r.ok ? r.json() : null)
        .then((data: ApiChat | null) => { if (data && data.id === currentChatIdRef.current) setChat(data); })
        .catch(() => scheduleRetry());
    };
    const onVisible = () => {
      if (!chatId || document.visibilityState !== "visible") return;
      if (readAndRefreshRetryRef.current) {
        clearTimeout(readAndRefreshRetryRef.current);
        readAndRefreshRetryRef.current = null;
      }
      readAndRefreshRetryScheduledRef.current = false;
      doReadAndRefresh(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (readAndRefreshRetryRef.current) clearTimeout(readAndRefreshRetryRef.current);
    };
  }, [chatId, setChat]);
}
