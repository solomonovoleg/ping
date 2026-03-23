/**
 * Хук: загрузка чата и сообщений, подписки (новые сообщения, печатает, голос), скролл.
 * Макс. 300 строк.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getMessages, listChatFolders } from "@/lib/chat";
import {
  CHAT_OUTBOX_FLUSHED,
  mergeOutboxIntoServerList,
  type ChatOutboxFlushedDetail,
} from "@/lib/chat-outbox";
import { getDraft } from "@/lib/chat-drafts";
import { API, apiFetch } from "@/lib/api-base";
import {
  getOfflineChatDetails,
  getOfflineMessages,
  saveOfflineChatDetails,
  saveOfflineMessages,
} from "@/lib/chat-offline-store";
import { isUuid } from "../utils/format";
import { parseMessageDate } from "../utils/format";
import { MESSAGES_PAGE, CHAT_LOAD_TIMEOUT_MS } from "../constants";
import type { ApiChat, ApiMessage } from "../types";
import { useChatVisibilityRefresh } from "./useChatVisibilityRefresh";
import { useChatRealtime } from "./useChatRealtime";

async function readApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text.trim()) return fallback;
    const j = JSON.parse(text) as { message?: string; error?: string };
    const m =
      (typeof j?.message === "string" && j.message.trim()) ? j.message.trim()
      : (typeof j?.error === "string" && j.error.trim()) ? j.error.trim()
      : "";
    return m || fallback;
  } catch {
    return fallback;
  }
}

/** Не чаще одного "typing" в 2.5 с; индикатор сбрасывается, если нет ввода 3 с */
const TYPING_THROTTLE_MS = 2500;
const TYPING_IDLE_MS = 3000;

export type UseChatMessagesParams = {
  chatIdParam: string;
  onDraftRestore?: (chatId: string, draft: string) => void;
};

export function useChatMessages({ chatIdParam, onDraftRestore }: UseChatMessagesParams) {
  const { user } = useAuth();
  const {
    subscribeChat,
    subscribeMessageDeleted,
    sendTyping,
    subscribeTyping,
    sendVoiceRecording,
    subscribeVoiceRecording,
    notifyChatListUpdate,
    onChatRead,
    onMessageReaction,
    onMessageEdited,
  } = useChatRealtime();
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
  const [initialRemoteMessagesResolved, setInitialRemoteMessagesResolved] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [typingDisplay, setTypingDisplay] = useState<string | null>(null);
  const [voiceRecordingDisplay, setVoiceRecordingDisplay] = useState<string | null>(null);
  const [folders, setFolders] = useState<
    { id: string; name: string; isMain: boolean; orderIndex: number; unreadCount?: number; messageCount?: number }[]
  >([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRestoreAfterPrependRef = useRef<{ height: number; top: number } | null>(null);
  const didInitialScrollRef = useRef(false);
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
    setInitialRemoteMessagesResolved(false);
    if (!id) {
      setLoading(false);
      setInitialRemoteMessagesResolved(true);
      setError("Чат не найден");
      return;
    }
    setLoading(true);
    setError(null);
    currentChatIdRef.current = id;
    let offlineSnapshotApplied = false;

    if (isUuid(id)) {
      void (async () => {
        const details = await getOfflineChatDetails(id);
        const offlineFolderId = details.currentFolderId ?? details.folders.find((folder) => folder.isMain)?.id ?? null;
        const offlineMessages = await getOfflineMessages(id, offlineFolderId);
        if (currentChatIdRef.current !== id) return;
        if (!details.chat) return;
        offlineSnapshotApplied = true;
        setResolvedChatId(id);
        setChat(details.chat);
        setFolders(details.folders);
        setCurrentFolderId(offlineFolderId);
        setHasMoreMessages(offlineMessages.length >= MESSAGES_PAGE);
        // Сразу показываем офлайн-снимок, чтобы не мигало «Нет сообщений» до завершения merge outbox.
        setMessages(offlineMessages);
        if (user?.id) {
          void mergeOutboxIntoServerList(id, user.id, offlineMessages, offlineFolderId).then((merged) => {
            if (currentChatIdRef.current === id) setMessages(merged);
          });
        }
        const draft = getDraft(id) ?? "";
        onDraftRestoreRef.current?.(id, draft);
        setLoading(false);
      })();
    }

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
          if (offlineSnapshotApplied) return;
          setLoading(false);
          setError("Загрузка прервана. Проверьте интернет и нажмите «Повторить».");
        }
      }, CHAT_LOAD_TIMEOUT_MS + 4000);
      fetchWithTimeout(url, { cache: "no-store" })
        .then(async (res) => {
          if (currentChatIdRef.current !== id) return;
          if (!res.ok) {
            setInitialRemoteMessagesResolved(true);
            if (!offlineSnapshotApplied) {
              setChat(null);
              setMessages([]);
              const statusFallback =
                res.status === 401 ? "Сессия истекла. Войдите снова."
                : res.status === 404 ? "Пользователь не найден"
                : res.status === 429
                  ? "Слишком много открытий чатов за короткое время. Подождите минуту."
                : "Не удалось загрузить чат";
              const errMsg = await readApiErrorMessage(res, statusFallback);
              setError(errMsg);
            }
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
            setInitialRemoteMessagesResolved(true);
            if (!offlineSnapshotApplied) setError("Не удалось открыть чат");
            setLoading(false);
            return;
          }
          setResolvedChatId(cId);
          setChat(chatData);
          const list: ApiMessage[] = "messages" in data && Array.isArray(data.messages) ? data.messages : [];
          const unreadNn = chatData.unreadCount ?? 0;
          const hasUnDm = chatData.hasUnread === true || unreadNn > 0;
          const dmLimit = hasUnDm ? Math.min(200, Math.max(MESSAGES_PAGE, unreadNn + 40)) : MESSAGES_PAGE;
          setHasMoreMessages(list.length >= dmLimit);
          // Показываем серверный список сразу, merge outbox выполняем поверх.
          setMessages(list);
          if (user?.id) {
            void mergeOutboxIntoServerList(cId, user.id, list, null).then((merged) => {
              if (currentChatIdRef.current === cId) setMessages(merged);
            });
          }
          void saveOfflineChatDetails(cId, chatData, [], null);
          void saveOfflineMessages(cId, null, list);
          const draft = getDraft(cId) ?? "";
          onDraftRestoreRef.current?.(cId, draft);
          setInitialRemoteMessagesResolved(true);
        })
        .catch((e) => {
          if (currentChatIdRef.current === id) {
            setInitialRemoteMessagesResolved(true);
            if (!offlineSnapshotApplied) {
              setError(e?.message === "timeout" ? "Превышено время ожидания. Проверьте интернет." : "Ошибка загрузки");
              setLoading(false);
            }
          }
        })
        .finally(() => {
          clearTimeout(safetyTimeout);
          if (currentChatIdRef.current === id && !offlineSnapshotApplied) setLoading(false);
        });
      return;
    }

    const base = `${API}/chats/${encodeURIComponent(id)}`;
    Promise.all([
      apiFetch(`${base}`, { cache: "no-store" }),
      apiFetch(`${base}/folders`, { cache: "no-store" }),
    ])
      .then(async ([chatRes, foldersRes]) => {
        if (currentChatIdRef.current !== id) return;
        if (!chatRes.ok) {
          setInitialRemoteMessagesResolved(true);
          if (!offlineSnapshotApplied) {
            setChat(null);
            setMessages([]);
            setFolders([]);
            setCurrentFolderId(null);
            const fb = chatRes.status === 404 ? "Чат не найден" : "Не удалось загрузить чат";
            setError(await readApiErrorMessage(chatRes, fb));
          }
          setLoading(false);
          return;
        }
        const chatData: ApiChat = await chatRes.json();
        if (currentChatIdRef.current !== id) return;
        setResolvedChatId(id);
        setChat(chatData);
        const foldersResData = foldersRes.ok ? await foldersRes.json() : [];
        const foldersList = Array.isArray(foldersResData)
          ? (foldersResData as {
              id: string;
              name: string;
              isMain: boolean;
              orderIndex: number;
              unreadCount?: number;
              messageCount?: number;
            }[])
          : [];
        setFolders(foldersList);
        const mainFolder = foldersList.find((f) => f.isMain) ?? foldersList[0];
        const folderId = mainFolder?.id ?? null;
        setCurrentFolderId(folderId);
        if (chatData.type === "group") {
          apiFetch(`${base}/folders`, { cache: "no-store" })
            .then(async (foldersRes2) => {
              if (foldersRes2.ok && currentChatIdRef.current === id) {
                const list2 = await foldersRes2.json();
                const foldersList2 = Array.isArray(list2)
                  ? (list2 as {
                      id: string;
                      name: string;
                      isMain: boolean;
                      orderIndex: number;
                      unreadCount?: number;
                      messageCount?: number;
                    }[])
                  : [];
                setFolders(foldersList2);
              }
            })
            .catch(() => {});
        }
        const unreadN = chatData.unreadCount ?? 0;
        const hasUn = chatData.hasUnread === true || unreadN > 0;
        const msgLimit = hasUn ? Math.min(200, Math.max(MESSAGES_PAGE, unreadN + 40)) : MESSAGES_PAGE;
        const msgParams = new URLSearchParams({ limit: String(msgLimit) });
        if (folderId) msgParams.set("folderId", folderId);
        const messagesRes = await apiFetch(`${base}/messages?${msgParams}`, { cache: "no-store" });
        const list: ApiMessage[] = messagesRes.ok ? await messagesRes.json() : [];
        if (currentChatIdRef.current === id) {
          setHasMoreMessages(list.length >= msgLimit);
          const arr = Array.isArray(list) ? list : [];
          // Показываем историю сразу, чтобы не рендерить пустое состояние между кадрами.
          setMessages(arr);
          if (user?.id) {
            void mergeOutboxIntoServerList(id, user.id, arr, folderId).then((merged) => {
              if (currentChatIdRef.current === id) setMessages(merged);
            });
          }
        }
        void saveOfflineChatDetails(id, chatData, foldersList, folderId);
        void saveOfflineMessages(id, folderId, list);
        if (currentChatIdRef.current !== id) return;
        const draft = getDraft(id) ?? "";
        onDraftRestoreRef.current?.(id, draft);
        setInitialRemoteMessagesResolved(true);
      })
      .catch(() => {
        if (currentChatIdRef.current === id) {
          setInitialRemoteMessagesResolved(true);
          if (!offlineSnapshotApplied) setError("Ошибка загрузки");
        }
      })
      .finally(() => {
        if (currentChatIdRef.current === id && !offlineSnapshotApplied) setLoading(false);
      });
  }, [chatIdParam, user?.id]);

  const loadOlderMessages = useCallback(async () => {
    const oldest = messages[0];
    if (
      !oldest ||
      oldest.id.startsWith("temp-") ||
      oldest.id.startsWith("obq-") ||
      loadingMoreMessages ||
      !hasMoreMessages ||
      !chatId
    )
      return;
    setLoadingMoreMessages(true);
    const container = scrollContainerRef.current;
    const oldHeight = container?.scrollHeight ?? 0;
    const oldTop = container?.scrollTop ?? 0;
    try {
      const older = await getMessages(chatId, {
        limit: 50,
        before: oldest.id,
        ...(currentFolderId && { folderId: currentFolderId }),
      });
      if (currentChatIdRef.current !== chatId) return;
      setMessages((prev) => [...(older as ApiMessage[]), ...prev]);
      setHasMoreMessages(older.length >= 50);
      scrollRestoreAfterPrependRef.current = { height: oldHeight, top: oldTop };
    } finally {
      if (currentChatIdRef.current === chatId) setLoadingMoreMessages(false);
    }
  }, [chatId, currentFolderId, messages, loadingMoreMessages, hasMoreMessages]);

  const refreshFolders = useCallback(async () => {
    if (!chatId || !chat || chat.type !== "group") return;
    try {
      const list = await listChatFolders(chatId);
      const foldersList = Array.isArray(list)
        ? (list as {
            id: string;
            name: string;
            isMain: boolean;
            orderIndex: number;
            unreadCount?: number;
            messageCount?: number;
          }[])
        : [];
      if (currentChatIdRef.current === chatId) setFolders(foldersList);
    } catch {
      // ignore
    }
  }, [chatId, chat?.type]);

  const loadMessagesForFolder = useCallback(
    async (folderId: string | null) => {
      if (!chatId || !chat || chat.type !== "group") return;
      setLoading(true);
      setCurrentFolderId(folderId);
      try {
        const msgParams = new URLSearchParams({ limit: String(MESSAGES_PAGE) });
        if (folderId) msgParams.set("folderId", folderId);
        const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages?${msgParams}`, {
          cache: "no-store",
        });
        const list: ApiMessage[] = res.ok ? await res.json() : [];
        if (currentChatIdRef.current === chatId) {
          setHasMoreMessages(list.length >= MESSAGES_PAGE);
          const arr = Array.isArray(list) ? list : [];
          // Для переключения папок тоже сначала показываем загруженные сообщения, потом merge.
          setMessages(arr);
          if (user?.id) {
            void mergeOutboxIntoServerList(chatId, user.id, arr, folderId).then((merged) => {
              if (currentChatIdRef.current === chatId) setMessages(merged);
            });
          }
        }
        void saveOfflineMessages(chatId, folderId, list);
      } catch {
        const cachedMessages = await getOfflineMessages(chatId, folderId);
        if (currentChatIdRef.current === chatId) {
          if (cachedMessages.length > 0) {
            setMessages(cachedMessages);
            setHasMoreMessages(cachedMessages.length >= MESSAGES_PAGE);
            setError(null);
          } else {
            setError("Не удалось загрузить сообщения");
          }
        }
      } finally {
        if (currentChatIdRef.current === chatId) setLoading(false);
      }
    },
    [chatId, chat, user?.id]
  );

  useEffect(() => {
    const onFlushed = (ev: Event) => {
      const d = (ev as CustomEvent<ChatOutboxFlushedDetail>).detail;
      if (!d || d.chatId !== chatId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === d.localId
            ? {
                ...m,
                id: d.message.id,
                type: d.message.type,
                content: d.message.content,
                createdAt: d.message.createdAt,
                sendStatus: undefined as ApiMessage["sendStatus"],
              }
            : m
        )
      );
    };
    window.addEventListener(CHAT_OUTBOX_FLUSHED, onFlushed);
    return () => window.removeEventListener(CHAT_OUTBOX_FLUSHED, onFlushed);
  }, [chatId, setMessages]);

  useEffect(() => {
    loadChatAndMessages();
  }, [loadChatAndMessages]);

  useEffect(() => {
    if (!chatId || !chat) return;
    void saveOfflineChatDetails(chatId, chat, folders, currentFolderId);
  }, [chatId, chat, folders, currentFolderId]);

  useEffect(() => {
    if (!chatId) return;
    void saveOfflineMessages(chatId, currentFolderId, messages);
  }, [chatId, currentFolderId, messages]);

  // При выходе из чата: обновить список чатов (без PUT /read без messageId — иначе ложные «прочитано»).
  useEffect(() => {
    return () => {
      if (!chatId) return;
      setTimeout(() => notifyChatListUpdate(), 250);
    };
  }, [chatId, notifyChatListUpdate]);

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

  /** Сброс якорного скролла при смене чата или полки группы. */
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [chatId, currentFolderId]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || loading || !chat || chat.id !== chatId) return;

    const scrollToBottom = (smooth: boolean) => {
      const target = container.scrollHeight - container.clientHeight;
      if (target <= 0) return;
      if (smooth) {
        container.scrollTo({ top: target, behavior: "smooth" });
      } else {
        container.scrollTop = target;
      }
    };

    const isInitial = !didInitialScrollRef.current;
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;

    if (isInitial) {
      // loading=false срабатывает до mergeOutbox — без сообщений не трогаем флаг, иначе скролл больше не восстановится.
      if (messages.length === 0) return;
      if (messages.some((m) => m.chatId !== chatId)) return;

      didInitialScrollRef.current = true;
      const uid = user?.id;
      const unreadN = chat.unreadCount ?? 0;
      const hasUn = chat.hasUnread === true || unreadN > 0;
      const myReadIso = chat.myLastReadAt ?? null;
      let anchorId: string | null = null;
      if (hasUn && uid) {
        const myReadMs = myReadIso ? parseMessageDate(myReadIso).getTime() : null;
        for (const m of messages) {
          if (m.chatId !== chatId) continue;
          if (m.senderId === uid || m.id.startsWith("temp-") || m.id.startsWith("obq-")) continue;
          const t = parseMessageDate(m.createdAt).getTime();
          if (myReadMs == null || t > myReadMs) {
            anchorId = m.id;
            break;
          }
        }
      }
      const alignFirstUnreadToBottom = (anchorEl: HTMLElement) => {
        /** Не «center» — иначе оказываемся в середине треда. Показываем хвост прочитанного сверху, первое непрочитанное у нижнего края списка. */
        const pad = 16;
        const cRect = container.getBoundingClientRect();
        const eRect = anchorEl.getBoundingClientRect();
        const delta = eRect.bottom - cRect.bottom + pad;
        container.scrollTop += delta;
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (anchorId) {
            const el = container.querySelector(`[data-message-id="${CSS.escape(anchorId)}"]`);
            if (el instanceof HTMLElement) {
              alignFirstUnreadToBottom(el);
              return;
            }
          }
          scrollToBottom(false);
        });
      });
      return;
    }

    if (nearBottom) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToBottom(true));
      });
    }
  }, [messages, chatId, loading, chat, user?.id]);

  const currentFolderIdRef = useRef(currentFolderId);
  currentFolderIdRef.current = currentFolderId;

  useEffect(() => {
    if (!chatId || !chat) return;
    const unsub = subscribeChat(chatId, (message) => {
      const msgFolderId = (message as ApiMessage & { folderId?: string | null }).folderId ?? null;
      const folderId = currentFolderIdRef.current;
      const msgInOtherFolder = chat.type === "group" && ((folderId != null && msgFolderId !== folderId) || (folderId == null && msgFolderId != null));
      if (msgInOtherFolder) {
        listChatFolders(chatId).then((list) => {
          if (Array.isArray(list) && currentChatIdRef.current === chatId) {
            setFolders(
              list as {
                id: string;
                name: string;
                isMain: boolean;
                orderIndex: number;
                unreadCount?: number;
                messageCount?: number;
              }[],
            );
          }
        }).catch(() => {});
        return;
      }
      flushSync(() => {
        setMessages((prev) => {
          const byId = new Map(prev.map((m) => [m.id, m]));
          if (message.senderId === user?.id) {
            for (const [id, m] of Array.from(byId.entries())) {
              if (id.startsWith("temp-") && m.senderId === message.senderId) {
                byId.delete(id);
                break;
              }
            }
          }
          const existing = byId.get(message.id);
          const msg = message as ApiMessage & { myReaction?: string | null };
          const merged = {
            ...(existing ?? {}),
            ...message,
            myReaction: msg.myReaction ?? existing?.myReaction ?? null,
          };
          byId.set(message.id, merged);
          return Array.from(byId.values()).sort(
            (a, b) => parseMessageDate(a.createdAt).getTime() - parseMessageDate(b.createdAt).getTime()
          );
        });
      });
      if (chat.type === "group") {
        listChatFolders(chatId).then((list) => {
          if (Array.isArray(list) && currentChatIdRef.current === chatId) {
            setFolders(
              list as {
                id: string;
                name: string;
                isMain: boolean;
                orderIndex: number;
                unreadCount?: number;
                messageCount?: number;
              }[],
            );
          }
        }).catch(() => {});
      }
    });
    return unsub;
  }, [chatId, chat?.type, subscribeChat, user?.id]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeMessageDeleted(chatId, (messageId) => {
      if (currentChatIdRef.current !== chatId) return;
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (chat?.type === "group") {
        listChatFolders(chatId).then((list) => {
          if (Array.isArray(list) && currentChatIdRef.current === chatId) {
            setFolders(
              list as {
                id: string;
                name: string;
                isMain: boolean;
                orderIndex: number;
                unreadCount?: number;
                messageCount?: number;
              }[],
            );
          }
        }).catch(() => {});
      }
    });
    return unsub;
  }, [chatId, chat?.type, subscribeMessageDeleted]);

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeTyping(chatId, (userId, displayName) => {
      if (userId === user?.id) return;
      flushSync(() => setTypingDisplay(displayName?.trim() || "Кто-то"));
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingDisplay(null), 5000);
    });
    return () => {
      unsub();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      setTypingDisplay(null);
    };
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
    return () => {
      unsub();
      if (voiceRecordingTimeoutRef.current) clearTimeout(voiceRecordingTimeoutRef.current);
      voiceRecordingTimeoutRef.current = null;
      setVoiceRecordingDisplay(null);
    };
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

  /** Обновление lastReadAt по WebSocket (chat-read) — прочитанность в реальном времени.
   * Refetch чата с сервера, чтобы гарантированно получить актуальный lastReadAt
   * независимо от подписки/закрытия вкладки. */
  useEffect(() => {
    const off = onChatRead(({ chatId: evChatId }) => {
      if (!evChatId || evChatId !== chatId) return;
      const base = `${API}/chats/${encodeURIComponent(chatId)}`;
      apiFetch(base)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: ApiChat | null) => {
          if (data?.id === currentChatIdRef.current) setChat(data);
        })
        .catch(() => {});
    });
    return off;
  }, [chatId]);

  /** Синхронизация реакций с собеседником по WebSocket (сервер шлёт после POST/DELETE реакции). */
  useEffect(() => {
    const uid = user?.id;
    const off = onMessageReaction((d) => {
      if (!d?.chatId || d.chatId !== chatId || !d.messageId) return;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== d.messageId) return m;
          const next: ApiMessage = { ...m, reactions: d.reactions };
          if (uid && d.userId === uid) {
            next.myReaction = d.emoji;
          }
          return next;
        })
      );
    });
    return off;
  }, [chatId, user?.id]);

  /** Синхронизация редактирования сообщений с собеседником по WebSocket. */
  useEffect(() => {
    const off = onMessageEdited((d) => {
      if (!d?.chatId || d.chatId !== chatId || !d.messageId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === d.messageId && m.type === "text" ? { ...m, content: d.content } : m))
      );
    });
    return off;
  }, [chatId]);

  useChatVisibilityRefresh(chatId, currentChatIdRef, setChat);

  const refreshChatMetadata = useCallback(() => {
    const id = chatId;
    if (!id) return;
    void apiFetch(`${API}/chats/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ApiChat | null) => {
        if (data && data.id === currentChatIdRef.current) setChat(data);
      })
      .catch(() => {});
  }, [chatId]);

  return {
    chatId,
    chat,
    setChat,
    folders,
    currentFolderId,
    loadMessagesForFolder,
    refreshFolders,
    messages,
    setMessages,
    loading,
    error,
    initialRemoteMessagesResolved,
    setError,
    hasMoreMessages,
    loadingMoreMessages,
    loadChatAndMessages,
    refreshChatMetadata,
    loadOlderMessages,
    scrollContainerRef,
    messagesEndRef,
    typingDisplay,
    voiceRecordingDisplay,
    scheduleSendTyping,
  };
}
