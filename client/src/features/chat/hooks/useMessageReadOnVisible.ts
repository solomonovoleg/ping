/**
 * Отмечает прочтение когда входящее сообщение в зоне просмотра.
 * Дублируем в API: `PUT /api/chats/:id/read` с `messageId` (как в mobile) — счётчик в списке не зависит только от WS.
 * Плюс `mark-chat-read` по WebSocket (/calls) для собеседника (`chat-read`, две галочки по otherMember.lastReadAt).
 *
 * Важно: не двигаем read, пока вкладка/приложение скрыты (visibilityState !== "visible"). Иначе чат,
 * оставленный открытым в фоновой вкладке, продолжает слать метки по IntersectionObserver — у собеседника
 * загораются две галочки, хотя он «не смотрит» в диалог.
 *
 * У хвоста диалога: при прокрутке к низу списка двигаем read до последнего входящего (не только по IntersectionObserver).
 * Узкий экран: у низа списка порог видимости ниже, чтобы однострочные пузыри чаще засчитывались.
 */
import { useEffect, useRef } from "react";
import { emitChatListUpdate, emitChatPendingUnreadClear } from "@/features/chat/realtime-events";
import { markChatReadAtMessage } from "@/lib/chat";
import { parseMessageDate } from "@/features/chat/utils/format";

const READ_DEBOUNCE_MS = 550;
const OBSERVER_ROOT_MARGIN = "0px 0px";
/** Строгий порядок — середина/верх списка */
const MIN_VISIBLE_RATIO = 0.5;
/** У нижней зоны списка (пользователь у «хвоста» переписки) */
const MIN_VISIBLE_RATIO_NEAR_BOTTOM = 0.22;
/** Считаем «у низа», если до конца скролла не больше этого (px) */
const NEAR_BOTTOM_PX = 120;

const SKIP_READ_ADVANCE_TYPES = new Set(["system"]);

function isNearBottomScroll(container: HTMLElement): boolean {
  const { scrollTop, scrollHeight, clientHeight } = container;
  return scrollHeight - clientHeight - scrollTop <= NEAR_BOTTOM_PX;
}

function isDocumentVisibleForReadReceipt(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

export function useMessageReadOnVisible(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  chatId: string,
  messages: { id: string; createdAt: string; senderId?: string | null; type?: string }[],
  currentUserId: string | null | undefined,
  sendMarkChatRead: (cid: string, messageId: string) => void,
) {
  const lastSentRef = useRef<string | null>(null);
  const lastSentCreatedAtMsRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleIdsRef = useRef<Set<string>>(new Set());
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chatId || !scrollContainerRef.current || messages.length === 0) return;
    lastSentRef.current = null;
    lastSentCreatedAtMsRef.current = 0;
    visibleIdsRef.current.clear();

    const container = scrollContainerRef.current;
    const messageById = new Map(
      messages.map((m) => [
        m.id,
        {
          ...m,
          type: m.type ?? "text",
          createdAtMs: parseMessageDate(m.createdAt).getTime(),
        },
      ])
    );

    const sendReadUpTo = (messageId: string, createdAt: string, createdAtMs: number) => {
      if (messageId.startsWith("temp-")) return;
      if (!Number.isFinite(createdAtMs)) return;
      if (!isDocumentVisibleForReadReceipt()) return;
      if (createdAtMs <= lastSentCreatedAtMsRef.current) return;
      lastSentRef.current = messageId;
      lastSentCreatedAtMsRef.current = createdAtMs;
      if (import.meta.env.DEV) {
        console.debug("[chat-read] send mark-chat-read (ws + http)", { chatId, messageId, createdAt });
      }
      try {
        sendMarkChatRead(chatId, messageId);
        emitChatPendingUnreadClear({ chatId });
        void markChatReadAtMessage(chatId, messageId)
          .then(() => {
            setTimeout(() => emitChatListUpdate(), 200);
          })
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn("[chat-read] markChatReadAtMessage failed (WS may have updated cursor)", {
                chatId,
                messageId,
                err,
              });
            }
            setTimeout(() => emitChatListUpdate(), 400);
          });
      } catch {
        lastSentRef.current = null;
        lastSentCreatedAtMsRef.current = 0;
      }
    };

    /** Все входящие в треде: чтобы у низа отметить прочитанным последнее, даже если Intersection «не дотянул» до 50%. */
    const newestIncomingInThread = (): { id: string; createdAt: string; createdAtMs: number } | null => {
      let newest: { id: string; createdAt: string; createdAtMs: number } | null = null;
      for (const m of messages) {
        const row = messageById.get(m.id);
        if (!row) continue;
        if (SKIP_READ_ADVANCE_TYPES.has(row.type)) continue;
        if (currentUserId && row.senderId === currentUserId) continue;
        if (!Number.isFinite(row.createdAtMs)) continue;
        if (!newest || row.createdAtMs > newest.createdAtMs) {
          newest = { id: row.id, createdAt: row.createdAt, createdAtMs: row.createdAtMs };
        }
      }
      return newest;
    };

    const flushVisible = () => {
      if (!isDocumentVisibleForReadReceipt()) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const visible = visibleIdsRef.current;
      const nearBottom = isNearBottomScroll(container);

      if (nearBottom) {
        const tail = newestIncomingInThread();
        if (tail) sendReadUpTo(tail.id, tail.createdAt, tail.createdAtMs);
      }

      if (visible.size === 0) return;
      let newest: { id: string; createdAt: string; createdAtMs: number; senderId?: string | null } | null = null;
      const visibleList = Array.from(visible);
      for (let i = 0; i < visibleList.length; i += 1) {
        const id = visibleList[i];
        const m = messageById.get(id);
        if (!m) continue;
        if (SKIP_READ_ADVANCE_TYPES.has(m.type)) continue;
        if (currentUserId && m.senderId === currentUserId) continue;
        if (!Number.isFinite(m.createdAtMs)) continue;
        if (!newest || m.createdAtMs > newest.createdAtMs) newest = m;
      }
      if (newest) sendReadUpTo(newest.id, newest.createdAt, newest.createdAtMs);
    };

    const scheduleFlush = () => {
      if (!isDocumentVisibleForReadReceipt()) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flushVisible, READ_DEBOUNCE_MS);
    };

    const onVisibilityChange = () => {
      if (!isDocumentVisibleForReadReceipt()) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        return;
      }
      if (isNearBottomScroll(container)) scheduleFlush();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const nearBottom = isNearBottomScroll(container);
        const minRatio = nearBottom ? MIN_VISIBLE_RATIO_NEAR_BOTTOM : MIN_VISIBLE_RATIO;
        for (const e of entries) {
          const id = (e.target as HTMLElement).getAttribute("data-message-id");
          if (!id) continue;
          const ratio = e.intersectionRatio;
          if (e.isIntersecting && ratio >= minRatio) {
            visibleIdsRef.current.add(id);
          } else {
            visibleIdsRef.current.delete(id);
          }
        }
        scheduleFlush();
      },
      {
        root: container,
        rootMargin: OBSERVER_ROOT_MARGIN,
        threshold: [0, 0.1, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 1],
      }
    );

    const observedEls = new WeakSet<Element>();
    const observeAll = () => {
      container.querySelectorAll("[data-message-id]").forEach((el) => {
        if (!observedEls.has(el)) {
          observedEls.add(el);
          observer.observe(el);
        }
      });
    };

    const onScroll = () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (isNearBottomScroll(container)) scheduleFlush();
      });
    };

    observeAll();
    const mo = new MutationObserver(() => {
      requestAnimationFrame(observeAll);
    });
    mo.observe(container, { childList: true, subtree: true });
    container.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    requestAnimationFrame(() => {
      if (isNearBottomScroll(container)) scheduleFlush();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      mo.disconnect();
      observer.disconnect();
      container.removeEventListener("scroll", onScroll);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [scrollContainerRef, chatId, messages, currentUserId, sendMarkChatRead]);
}
