/**
 * При возврате на вкладку / приложение из фона: обновить данные чата.
 * Список сообщений в фоне по WS не приходит — его догружает колбэк onResume (useChatMessages).
 * Прочитанность только через WS mark-chat-read с messageId (useMessageReadOnVisible) при открытом чате.
 */
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { API, apiFetch } from "@/lib/api-base";
import type { ApiChat } from "../types";
import { mergeChatPreservingNewerOtherLastRead } from "../utils/chat-metadata-merge";

export function useChatVisibilityRefresh(
  chatId: string,
  currentChatIdRef: { current: string },
  setChat: Dispatch<SetStateAction<ApiChat | null>>,
  onResume?: () => void,
) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

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
      const warnDev = (msg: string, err?: unknown) => {
        if (import.meta.env.DEV) console.warn(`[chat] ${msg}`, err ?? "");
      };
      apiFetch(base)
        .then((r) => r.ok ? r.json() : null)
        .then((data: ApiChat | null) => {
          if (data && data.id === currentChatIdRef.current) {
            setChat((prev) => mergeChatPreservingNewerOtherLastRead(prev, data));
          }
        })
        .catch((err) => {
          warnDev("chat refresh failed on visibilitychange, scheduling retry", err);
          scheduleRetry();
        });
    };
    const onVisible = () => {
      if (!chatId || document.visibilityState !== "visible") return;
      if (readAndRefreshRetryRef.current) {
        clearTimeout(readAndRefreshRetryRef.current);
        readAndRefreshRetryRef.current = null;
      }
      readAndRefreshRetryScheduledRef.current = false;
      doReadAndRefresh(false);
      onResumeRef.current?.();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (readAndRefreshRetryRef.current) clearTimeout(readAndRefreshRetryRef.current);
    };
  }, [chatId, setChat]);
}
