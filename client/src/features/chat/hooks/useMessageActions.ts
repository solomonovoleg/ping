/**
 * Хук: меню сообщения, реакции, long-press, копировать, удалить, редактировать, переслать, избранное, выбор. Макс. 300 строк.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { addMessageReaction, removeMessageReaction, saveMessage, unsaveMessage, isMessageSaved, sendMessage } from "@/lib/chat";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/lib/capacitor-native";
import { API, apiFetch } from "@/lib/api-base";
import { playDeleteSound } from "@/lib/send-sound";
import { parseMessageDate } from "../utils/format";
import type { ApiMessage } from "../types";

export type UseMessageActionsParams = {
  chatId: string;
  messages: ApiMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ApiMessage[]>>;
  user: { id: string } | null;
  onEdit?: (msg: ApiMessage) => void;
};

export function useMessageActions({ chatId, messages, setMessages, user, onEdit }: UseMessageActionsParams) {
  const { toast } = useToast();
  const [messageMenu, setMessageMenu] = useState<{ msg: ApiMessage; x: number; y: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardingMessage, setForwardingMessage] = useState<ApiMessage | null>(null);
  const [addToTrackMessage, setAddToTrackMessage] = useState<ApiMessage | null>(null);
  const [messageSavedMap, setMessageSavedMap] = useState<Record<string, boolean>>({});
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [shatteringMessageId, setShatteringMessageId] = useState<string | null>(null);

  const messageMenuRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressConsumedMessageIdRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<{ msg: ApiMessage; forEveryone: boolean } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const closeMenu = useCallback(() => {
    setMessageMenu(null);
    longPressConsumedMessageIdRef.current = null;
  }, []);

  const reactionLockRef = useRef(false);
  const handleReaction = useCallback(
    async (msg: ApiMessage, emoji: string) => {
      if (reactionLockRef.current) return;
      triggerLightHaptic();
      closeMenu();
      const previousMy = msg.myReaction ?? null;
      const isRemoving = previousMy === emoji;
      reactionLockRef.current = true;
      try {
        if (isRemoving) {
          await removeMessageReaction(chatId, msg.id);
        } else {
          await addMessageReaction(chatId, msg.id, emoji);
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msg.id) return m;
            const list = (m.reactions ?? []).map((r) => ({ ...r }));
            const prevEmoji = m.myReaction ?? null;
            if (prevEmoji) {
              const idx = list.findIndex((r) => r.emoji === prevEmoji);
              if (idx >= 0) {
                list[idx].count--;
                if (list[idx].count <= 0) list.splice(idx, 1);
              }
            }
            if (!isRemoving) {
              const i = list.findIndex((r) => r.emoji === emoji);
              if (i >= 0) list[i].count++;
              else list.push({ emoji, count: 1 });
            }
            return {
              ...m,
              reactions: list,
              myReaction: isRemoving ? null : emoji,
            };
          })
        );
      } catch {
        toast({ title: isRemoving ? "Не удалось убрать реакцию" : "Не удалось поставить реакцию", variant: "destructive" });
      } finally {
        reactionLockRef.current = false;
      }
    },
    [chatId, closeMenu, toast, setMessages]
  );

  const handleMessagePointerDown = useCallback((msg: ApiMessage, e: React.PointerEvent) => {
    if (msg.type === "system" || msg.type === "missed_call") return;
    if (!msg?.id) return;
    clearLongPress();
    longPressConsumedMessageIdRef.current = null;
    const x = typeof (e as { clientX?: number }).clientX === "number" ? (e as { clientX: number }).clientX : 0;
    const y = typeof (e as { clientY?: number }).clientY === "number" ? (e as { clientY: number }).clientY : 0;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      try {
        longPressConsumedMessageIdRef.current = msg.id;
        triggerLightHaptic();
        setMessageMenu({ msg, x, y });
      } catch (err) {
        console.error("[useMessageActions] long-press menu open failed:", err);
      }
    }, 500);
  }, [clearLongPress]);

  const handleMessagePointerUp = useCallback(
    (messageId: string) => {
      clearLongPress();
      if (longPressConsumedMessageIdRef.current === messageId) {
        longPressConsumedMessageIdRef.current = null;
      }
    },
    [clearLongPress]
  );
  const handleMessagePointerLeave = useCallback(() => clearLongPress(), [clearLongPress]);
  const handleMessageContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        const row = (e.target as HTMLElement)?.closest?.("[data-message-id]");
        if (!row) return;
        const msgId = row.getAttribute("data-message-id");
        if (!msgId) return;
        const msg = messages.find((m) => m.id === msgId);
        if (!msg || msg.type === "system" || msg.type === "missed_call") return;
        triggerLightHaptic();
        const rect = row.getBoundingClientRect();
        setMessageMenu({ msg, x: rect.left, y: rect.bottom + 4 });
      } catch (err) {
        console.error("[useMessageActions] contextmenu menu open failed:", err);
      }
    },
    [messages]
  );

  const scrollToMessageAndHighlight = useCallback((messageId: string) => {
    const el = document.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        highlightTimeoutRef.current = null;
      }, 1500);
    }
  }, []);

  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  const handleCopy = useCallback((msg: ApiMessage) => {
    if (msg.type === "text") {
      navigator.clipboard.writeText(msg.content);
      toast({ title: "Скопировано" });
    }
    closeMenu();
  }, [toast, closeMenu]);

  const restoreMessageInList = useCallback((removedMsg: ApiMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      const idx = next.findIndex((m) => parseMessageDate(m.createdAt).getTime() > parseMessageDate(removedMsg.createdAt).getTime());
      next.splice(idx < 0 ? next.length : idx, 0, removedMsg);
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (msg: ApiMessage, forEveryone: boolean) => {
      if (pendingDeleteRef.current) return;
      triggerSelectionHaptic();
      playDeleteSound();
      closeMenu();
      pendingDeleteRef.current = { msg, forEveryone };
      setShatteringMessageId(msg.id);
    },
    [closeMenu]
  );

  const handleEdit = useCallback((msg: ApiMessage) => {
    if (msg.type !== "text") return;
    onEdit?.(msg);
    closeMenu();
  }, [closeMenu, onEdit]);

  const handleForward = useCallback((msg: ApiMessage) => {
    setForwardingMessage(msg);
    closeMenu();
  }, [closeMenu]);

  const handleAddToTrack = useCallback((msg: ApiMessage) => {
    setAddToTrackMessage(msg);
    closeMenu();
  }, [closeMenu]);

  const handleForwardToChat = useCallback(
    async (targetChatId: string) => {
      if (!forwardingMessage || !chatId) return;
      try {
        await sendMessage(targetChatId, {
          content: forwardingMessage.content,
          type: forwardingMessage.type as "text" | "voice" | "image" | "video",
          forwardedFromMessageId: forwardingMessage.id,
          originalChatId: chatId,
        });
        toast({ title: "Переслано" });
        setForwardingMessage(null);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось переслать", variant: "destructive" });
      }
    },
    [forwardingMessage, chatId, toast]
  );

  const handleSaveMessage = useCallback(
    async (msg: ApiMessage) => {
      try {
        await saveMessage(msg.id, chatId);
        setMessageSavedMap((prev) => ({ ...prev, [msg.id]: true }));
        toast({ title: "Сохранено в избранное" });
        closeMenu();
      } catch {
        toast({ title: "Не удалось сохранить", variant: "destructive" });
      }
    },
    [chatId, closeMenu, toast]
  );

  const handleUnsaveMessage = useCallback(
    async (msg: ApiMessage) => {
      try {
        await unsaveMessage(msg.id);
        setMessageSavedMap((prev) => ({ ...prev, [msg.id]: false }));
        toast({ title: "Убрано из избранного" });
        closeMenu();
      } catch {
        toast({ title: "Не удалось убрать", variant: "destructive" });
      }
    },
    [closeMenu, toast]
  );

  const handleSelect = useCallback((msg: ApiMessage) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(msg.id)) next.delete(msg.id);
      else next.add(msg.id);
      return next;
    });
    closeMenu();
  }, [closeMenu]);

  // Не вешаем listener сразу: на touch после long-press иногда приходит ещё один pointerdown
  // или ref меню ещё не смонтирован — меню мгновенно закрывается или React/Framer ломаются.
  useEffect(() => {
    if (!messageMenu) return;
    let removed = false;
    let handler: ((e: PointerEvent) => void) | null = null;
    const attachDelayMs = 320;
    const timer = window.setTimeout(() => {
      if (removed) return;
      handler = (e: PointerEvent) => {
        if (messageMenuRef.current?.contains(e.target as Node)) return;
        closeMenu();
      };
      document.addEventListener("pointerdown", handler, { capture: true });
    }, attachDelayMs);
    return () => {
      removed = true;
      window.clearTimeout(timer);
      if (handler) document.removeEventListener("pointerdown", handler, { capture: true });
    };
  }, [messageMenu, closeMenu]);

  useEffect(() => {
    if (!messageMenu?.msg?.id) return;
    const msgId = messageMenu.msg.id;
    isMessageSaved(msgId).then((saved) => {
      setMessageSavedMap((prev) => ({ ...prev, [msgId]: saved }));
    }).catch(() => {});
  }, [messageMenu?.msg?.id]);

  const { data: forwardChats = [] } = useQuery({
    queryKey: ["chats"],
    queryFn: async () => {
      const res = await apiFetch(`${API}/chats`, { cache: "no-store" });
      if (!res.ok) throw new Error("Не удалось загрузить чаты");
      return res.json() as Promise<{ id: string; name: string | null; type: string }[]>;
    },
    enabled: !!forwardingMessage,
  });
  const forwardChatsFiltered = forwardChats.filter((c) => c.id !== chatId);

  const selectedList = Array.from(selectedIds);
  const handleForwardSelected = useCallback(() => {
    const texts = selectedList
      .map((id) => messages.find((m) => m.id === id))
      .filter((m): m is ApiMessage => !!m && m.type === "text")
      .map((m) => m.content);
    if (texts.length) {
      navigator.clipboard.writeText(texts.join("\n\n"));
      toast({ title: `Скопировано сообщений: ${texts.length}` });
    }
    setSelectedIds(new Set());
  }, [selectedList, messages, toast]);

  const handleClearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleShatterComplete = useCallback((messageId: string) => {
    const pending = pendingDeleteRef.current;
    if (!pending || pending.msg.id !== messageId) {
      setShatteringMessageId(null);
      return;
    }
    pendingDeleteRef.current = null;
    const { msg, forEveryone } = pending;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    setShatteringMessageId(null);
    const query = forEveryone ? "?for=everyone" : "?for=me";
    void apiFetch(
      `${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(msg.id)}${query}`,
      { method: "DELETE" }
    )
      .then(async (res) => {
        if (res.ok) {
          toast({ title: "Сообщение удалено" });
          return;
        }
        restoreMessageInList(msg);
        const data = await res.json().catch(() => ({}));
        toast({ title: data.message ?? "Не удалось удалить", variant: "destructive" });
      })
      .catch(() => {
        restoreMessageInList(msg);
        toast({ title: "Ошибка", variant: "destructive" });
      });
  }, [setMessages, toast, chatId, restoreMessageInList]);

  return {
    messageMenu,
    setMessageMenu,
    messageMenuRef,
    closeMenu,
    handleReaction,
    handleMessagePointerDown,
    handleMessagePointerUp,
    handleMessagePointerLeave,
    handleMessageContextMenu,
    handleCopy,
    handleDelete,
    handleEdit,
    handleForward,
    handleForwardToChat,
    handleSaveMessage,
    handleUnsaveMessage,
    handleSelect,
    selectedIds,
    setSelectedIds,
    handleForwardSelected,
    handleClearSelection,
    forwardingMessage,
    setForwardingMessage,
    addToTrackMessage,
    setAddToTrackMessage,
    handleAddToTrack,
    forwardChatsFiltered,
    messageSavedMap,
    scrollToMessageAndHighlight,
    highlightedMessageId,
    shatteringMessageId,
    handleShatterComplete,
  };
}
