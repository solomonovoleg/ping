/**
 * Отмечает прочтение только когда входящее сообщение реально попало в зону просмотра (не край экрана / не 10% пузыря).
 * PUT /chats/:id/read с messageId — сервер двигает last_read у читателя; у отправителя две галочки по otherMember.lastReadAt.
 */
import { useEffect, useRef } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { emitChatListUpdate, emitChatPendingUnreadClear } from "@/features/chat/realtime-events";

const READ_DEBOUNCE_MS = 550;
/** Без раздувания root — не отмечаем прочитанным то, что ещё «за кадром» */
const OBSERVER_ROOT_MARGIN = "0px 0px";
/** Доля площади сообщения в корне скролла, чтобы считать «увидел» (строже, чем threshold 0.1) */
const MIN_VISIBLE_RATIO = 0.5;
/** Не двигаем курсор чтения по служебным плашкам */
const SKIP_READ_ADVANCE_TYPES = new Set(["system", "missed_call"]);

export function useMessageReadOnVisible(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  chatId: string,
  messages: { id: string; createdAt: string; senderId?: string | null; type?: string }[],
  currentUserId?: string | null
) {
  const lastSentRef = useRef<string | null>(null);
  const lastSentCreatedAtMsRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleIdsRef = useRef<Set<string>>(new Set());

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
          createdAtMs: Date.parse(m.createdAt),
        },
      ])
    );

    const sendReadUpTo = (messageId: string, createdAt: string, createdAtMs: number) => {
      if (messageId.startsWith("temp-")) return;
      if (!Number.isFinite(createdAtMs)) return;
      if (createdAtMs <= lastSentCreatedAtMsRef.current) return;
      lastSentRef.current = messageId;
      lastSentCreatedAtMsRef.current = createdAtMs;
      if (import.meta.env.DEV) {
        console.debug("[chat-read] send /read", { chatId, messageId, createdAt });
      }
      apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/read`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      })
        .then(() => {
          emitChatPendingUnreadClear({ chatId });
          setTimeout(() => emitChatListUpdate(), 250);
        })
        .catch(() => {
          lastSentRef.current = null;
          lastSentCreatedAtMsRef.current = 0;
        });
    };

    const flushVisible = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const visible = visibleIdsRef.current;
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

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).getAttribute("data-message-id");
          if (!id) continue;
          const ratio = e.intersectionRatio;
          if (e.isIntersecting && ratio >= MIN_VISIBLE_RATIO) {
            visibleIdsRef.current.add(id);
          } else {
            visibleIdsRef.current.delete(id);
          }
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(flushVisible, READ_DEBOUNCE_MS);
      },
      {
        root: container,
        rootMargin: OBSERVER_ROOT_MARGIN,
        threshold: [0, 0.1, 0.25, 0.35, 0.5, 0.65, 0.8, 1],
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

    observeAll();
    const mo = new MutationObserver(() => {
      requestAnimationFrame(observeAll);
    });
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scrollContainerRef, chatId, messages, currentUserId]);
}
