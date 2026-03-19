/**
 * Отмечает сообщения прочитанными, когда они становятся видимыми в viewport.
 * Отправляет PUT /chats/:id/read с messageId — сервер обновляет lastReadAt и уведомляет отправителя (две галочки).
 */
import { useEffect, useRef } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { emitChatListUpdate } from "@/features/chat/realtime-events";

const READ_DEBOUNCE_MS = 400;
const OBSERVER_ROOT_MARGIN = "50px 0px";

export function useMessageReadOnVisible(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  chatId: string,
  messages: { id: string; createdAt: string; senderId?: string | null }[],
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
          if (e.isIntersecting) {
            visibleIdsRef.current.add(id);
          } else {
            visibleIdsRef.current.delete(id);
          }
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(flushVisible, READ_DEBOUNCE_MS);
      },
      { root: container, rootMargin: OBSERVER_ROOT_MARGIN, threshold: 0.1 }
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
