/**
 * Хук: загрузка чата и сообщений, подписки (новые сообщения, печатает, голос), скролл.
 * Макс. 300 строк.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCallContext } from "@/contexts/CallContext";
import { getMessages } from "@/lib/chat";
import { getDraft } from "@/lib/chat-drafts";
import { API, apiFetch } from "@/lib/api-base";
import { isUuid } from "../utils/format";
import { MESSAGES_PAGE, CHAT_LOAD_TIMEOUT_MS } from "../constants";
import type { ApiChat, ApiMessage } from "../types";
import { useChatVisibilityRefresh } from "./useChatVisibilityRefresh";

/** Не чаще одного "typing" в 2.5 с; индикатор сбрасывается, если нет ввода 3 с */
const TYPING_THROTTLE_MS = 2500;
const TYPING_IDLE_MS = 3000;

export type UseChatMessagesParams = {
  chatIdParam: string;
  onDraftRestore?: (chatId: string, draft: string) => void;
};

export function useChatMessages({ chatIdParam, onDraftRestore }: UseChatMessagesParams) {
  const { user } = useAuth();
  const { subscribeChat, sendTyping, subscribeTyping, sendVoiceRecording, subscribeVoiceRecording } = useCallContext();
  const onDraftRestoreRef = useRef(onDraftRestore);
  onDraftRestoreRef.current = onDraftRestore;

  const [resolvedChatId, setResolvedChatId] = useState<string | null>(() =>
    isUuid(chatIdParam) ? chatIdParam : null
  );
  const chatId = resolvedChatId ?? "";
  const currentChatIdRef = useRef(chatId);
  currentChatIdRef.current = resolvedChatId ?? chatIdParam ?? "";

  const [chat, setChat] = useState<ApiChat | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [typingDisplay, setTypingDisplay] = useState<string | null>(null);
  const [voiceRecordingDisplay, setVoiceRecordingDisplay] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRestoreAfterPrependRef = useRef<{ height: number; top: number } | null>(null);
  const didInitialScrollRef = useRef(false);
  const prevChatIdRef = useRef(chatId);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingActivityRef = useRef<number>(0);
  const lastTypingSentRef = useRef<number>(0);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isUuid(chatIdParam)) setResolvedChatId(chatIdParam);
    else setResolvedChatId(null);
  }, [chatIdParam]);

  const loadChatAndMessages = useCallback(() => {
    const id = chatIdParam;
    if (!id) {
      setLoading(false);
      setError("Чат не найден");
      return;
    }
    setLoading(true);
    setError(null);
    currentChatIdRef.current = id;

    const fetchWithTimeout = (url: string, opts?: RequestInit) =>
      Promise.race([
        apiFetch(url, opts),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), CHAT_LOAD_TIMEOUT_MS)
        ),
      ]);

    if (/^\d+$/.test(id)) {
      const url = `${API}/chats/dm-by-public-id/${encodeURIComponent(id)}?limit=${MESSAGES_PAGE}`;
      const safetyTimeout = setTimeout(() => {
        if (currentChatIdRef.current === id) {
          setLoading(false);
          setError("Загрузка прервана. Проверьте интернет и нажмите «Повторить».");
        }
      }, CHAT_LOAD_TIMEOUT_MS + 4000);
      fetchWithTimeout(url, { cache: "no-store" })
        .then(async (res) => {
          if (currentChatIdRef.current !== id) return;
          if (!res.ok) {
            setChat(null);
            setMessages([]);
            const errMsg =
              res.status === 401 ? "Сессия истекла. Войдите снова."
              : res.status === 404 ? "Пользователь не найден"
              : res.status === 400 ? "Некорректный запрос"
              : "Не удалось загрузить чат";
            setError(errMsg);
            setLoading(false);
            return;
          }
          let data: { chat: ApiChat; messages?: ApiMessage[] } | ApiChat;
          try {
            data = await res.json();
          } catch {
            if (currentChatIdRef.current === id) {
              setError("Неверный ответ сервера");
              setLoading(false);
            }
            return;
          }
          if (currentChatIdRef.current !== id) return;
          const chatData = "chat" in data && data.chat ? data.chat : (data as ApiChat);
          const cId = chatData?.id;
          if (!cId || typeof cId !== "string") {
            setError("Не удалось открыть чат");
            setLoading(false);
            return;
          }
          setResolvedChatId(cId);
          setChat(chatData);
          const list: ApiMessage[] = "messages" in data && Array.isArray(data.messages) ? data.messages : [];
          setMessages(list);
          setHasMoreMessages(list.length >= MESSAGES_PAGE);
          const draft = getDraft(cId) ?? "";
          onDraftRestoreRef.current?.(cId, draft);
          apiFetch(`${API}/chats/${encodeURIComponent(cId)}/read`, { method: "PUT" }).catch(() => {});
        })
        .catch((e) => {
          if (currentChatIdRef.current === id) {
            setError(e?.message === "timeout" ? "Превышено время ожидания. Проверьте интернет." : "Ошибка загрузки");
            setLoading(false);
          }
        })
        .finally(() => {
          clearTimeout(safetyTimeout);
          if (currentChatIdRef.current === id) setLoading(false);
        });
      return;
    }

    const base = `${API}/chats/${encodeURIComponent(id)}`;
    Promise.all([
      apiFetch(`${base}`, { cache: "no-store" }),
      apiFetch(`${base}/messages?limit=${MESSAGES_PAGE}`, { cache: "no-store" }),
    ])
      .then(async ([chatRes, messagesRes]) => {
        if (currentChatIdRef.current !== id) return;
        if (!chatRes.ok) {
          setChat(null);
          setMessages([]);
          setError(chatRes.status === 404 ? "Чат не найден" : "Не удалось загрузить чат");
          setLoading(false);
          return;
        }
        const chatData: ApiChat = await chatRes.json();
        if (currentChatIdRef.current !== id) return;
        setResolvedChatId(id);
        setChat(chatData);
        apiFetch(`${base}/read`, { method: "PUT" }).catch(() => {});
        const list: ApiMessage[] = messagesRes.ok ? await messagesRes.json() : [];
        if (currentChatIdRef.current === id) {
          setMessages(Array.isArray(list) ? list : []);
          setHasMoreMessages(list.length >= MESSAGES_PAGE);
        }
        if (currentChatIdRef.current !== id) return;
        const draft = getDraft(id) ?? "";
        onDraftRestoreRef.current?.(id, draft);
      })
      .catch(() => {
        if (currentChatIdRef.current === id) setError("Ошибка загрузки");
      })
      .finally(() => {
        if (currentChatIdRef.current === id) setLoading(false);
      });
  }, [chatIdParam]);

  const loadOlderMessages = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || oldest.id.startsWith("temp-") || loadingMoreMessages || !hasMoreMessages || !chatId) return;
    setLoadingMoreMessages(true);
    const container = scrollContainerRef.current;
    const oldHeight = container?.scrollHeight ?? 0;
    const oldTop = container?.scrollTop ?? 0;
    try {
      const older = await getMessages(chatId, { limit: 50, before: oldest.id });
      if (currentChatIdRef.current !== chatId) return;
      setMessages((prev) => [...(older as ApiMessage[]), ...prev]);
      setHasMoreMessages(older.length >= 50);
      scrollRestoreAfterPrependRef.current = { height: oldHeight, top: oldTop };
    } finally {
      if (currentChatIdRef.current === chatId) setLoadingMoreMessages(false);
    }
  }, [chatId, messages, loadingMoreMessages, hasMoreMessages]);

  useEffect(() => {
    loadChatAndMessages();
  }, [loadChatAndMessages]);

  useEffect(() => {
    if (!scrollRestoreAfterPrependRef.current) return;
    const c = scrollContainerRef.current;
    const rest = scrollRestoreAfterPrependRef.current;
    scrollRestoreAfterPrependRef.current = null;
    if (!c || !rest) return;
    const restore = () => {
      c.scrollTop = c.scrollHeight - rest.height + rest.top;
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(restore);
    });
  }, [messages]);

  if (prevChatIdRef.current !== chatId) { prevChatIdRef.current = chatId; didInitialScrollRef.current = false; }
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const isInitial = !didInitialScrollRef.current;
    if (isInitial) didInitialScrollRef.current = true;
    const scrollToBottom = (smooth: boolean) => {
      const target = container.scrollHeight - container.clientHeight;
      if (target <= 0) return;
      if (smooth) {
        container.scrollTo({ top: target, behavior: "smooth" });
      } else {
        container.scrollTop = target;
      }
    };
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isInitial) {
      requestAnimationFrame(() => scrollToBottom(false));
    } else if (nearBottom) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(true));
      });
    }
  }, [messages, chatId]);

  useEffect(() => {
    if (!chatId || !chat) return;
    const unsub = subscribeChat(chatId, (message) => {
      flushSync(() => {
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          if (message.senderId === user?.id) {
            for (const [id, m] of byId.entries()) {
              if (id.startsWith("temp-") && m.senderId === message.senderId) {
                byId.delete(id);
                break;
              }
            }
          }
          const existing = byId.get(message.id);
          const merged = { ...message, myReaction: message.myReaction ?? existing?.myReaction ?? null };
          byId.set(message.id, merged);
          return Array.from(byId.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
      });
    });
    return unsub;
  }, [chatId, chat, subscribeChat, user?.id]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeTyping(chatId, (userId, displayName) => {
      if (userId === user?.id) return;
      flushSync(() => setTypingDisplay(displayName?.trim() || "Кто-то"));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingDisplay(null), 5000);
    });
    return () => { unsub(); if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); };
  }, [chatId, user?.id, subscribeTyping]);

  useEffect(() => {
    if (!chatId || !user) return;
    const unsub = subscribeVoiceRecording(chatId, (userId, displayName, recording) => {
      if (userId === user.id) return;
      if (recording) {
        flushSync(() => setVoiceRecordingDisplay(displayName?.trim() || "Кто-то"));
        if (voiceRecordingTimeoutRef.current) clearTimeout(voiceRecordingTimeoutRef.current);
        voiceRecordingTimeoutRef.current = setTimeout(() => setVoiceRecordingDisplay(null), 6000);
      } else {
        flushSync(() => setVoiceRecordingDisplay(null));
        if (voiceRecordingTimeoutRef.current) clearTimeout(voiceRecordingTimeoutRef.current);
        voiceRecordingTimeoutRef.current = null;
      }
    });
    return () => { unsub(); if (voiceRecordingTimeoutRef.current) clearTimeout(voiceRecordingTimeoutRef.current); };
  }, [chatId, user?.id, subscribeVoiceRecording]);

  const scheduleSendTyping = useCallback(() => {
    if (!chatId || !user) return;
    const name = [user.displayName, user.surname].filter(Boolean).join(" ") || null;
    const now = Date.now();
    lastTypingActivityRef.current = now;
    if (now - lastTypingSentRef.current >= TYPING_THROTTLE_MS) {
      sendTyping(chatId, name);
      lastTypingSentRef.current = now;
    }
    if (!typingIntervalRef.current) {
      typingIntervalRef.current = setInterval(() => {
        const t = Date.now();
        if (t - lastTypingActivityRef.current > TYPING_IDLE_MS) {
          if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
          return;
        }
        if (t - lastTypingSentRef.current >= TYPING_THROTTLE_MS) {
          sendTyping(chatId, name);
          lastTypingSentRef.current = t;
        }
      }, TYPING_THROTTLE_MS);
    }
  }, [chatId, user, sendTyping]);

  useEffect(() => () => { if (typingIntervalRef.current) clearInterval(typingIntervalRef.current); typingIntervalRef.current = null; }, [chatId]);

  useEffect(() => {
    if (!chatId || !chat) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      apiFetch(`${API}/chats/${encodeURIComponent(chatId)}`, { cache: "no-store" })
        .then((r) => r.ok ? r.json() : null)
        .then((data: ApiChat | null) => { if (data) setChat(data); })
        .catch(() => {});
    };
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [chatId, chat]);
  useChatVisibilityRefresh(chatId, currentChatIdRef, setChat);
  return {
    chatId,
    chat,
    setChat,
    messages,
    setMessages,
    loading,
    error,
    setError,
    hasMoreMessages,
    loadingMoreMessages,
    loadChatAndMessages,
    loadOlderMessages,
    scrollContainerRef,
    messagesEndRef,
    typingDisplay,
    voiceRecordingDisplay,
    scheduleSendTyping,
  };
}
