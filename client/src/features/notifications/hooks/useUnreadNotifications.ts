import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchNotifications, type NotificationItem } from "@/lib/notifications";
import { playLikeNotificationSound } from "@/lib/send-sound";

const BASE_REFETCH_MS = 22000;
const FAST_REFETCH_MS = 12000;
const MAX_LIST_FOR_COUNT = 100;

export type UnreadNotificationsState = {
  unreadCount: number;
  hasUnread: boolean;
  pulseDurationMs: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

function getPulseDurationMs(unreadCount: number): number {
  if (unreadCount <= 0) return 1500;
  if (unreadCount <= 2) return 1300;
  if (unreadCount <= 5) return 1000;
  if (unreadCount <= 10) return 850;
  return 700;
}

/**
 * Единый источник правды для индикатора непрочитанных уведомлений.
 * - Пока есть непрочитанные — опрашиваем чуть чаще.
 * - Когда непрочитанных нет — реже, чтобы не создавать лишнюю нагрузку.
 */
export function useUnreadNotifications(): UnreadNotificationsState {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(MAX_LIST_FOR_COUNT, 0),
    refetchOnWindowFocus: true,
    refetchInterval: (q) => {
      const list = Array.isArray(q.state.data) ? q.state.data : [];
      const unread = list.reduce((sum, n) => sum + (n.readAt ? 0 : 1), 0);
      return unread > 0 ? FAST_REFETCH_MS : BASE_REFETCH_MS;
    },
  });

  const unreadCount = useMemo(() => {
    const list = Array.isArray(query.data) ? query.data : [];
    return list.reduce((sum, n) => sum + (n.readAt ? 0 : 1), 0);
  }, [query.data]);
  const isInitializedRef = useRef(false);
  const prevUnreadIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const list = Array.isArray(query.data) ? (query.data as NotificationItem[]) : [];
    const unreadIds = new Set(list.filter((n) => !n.readAt).map((n) => n.id));
    if (!isInitializedRef.current) {
      prevUnreadIdsRef.current = unreadIds;
      isInitializedRef.current = true;
      return;
    }
    const hasNewUnread = Array.from(unreadIds).some((id) => !prevUnreadIdsRef.current.has(id));
    if (hasNewUnread) {
      playLikeNotificationSound();
    }
    prevUnreadIdsRef.current = unreadIds;
  }, [query.data]);

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
    pulseDurationMs: getPulseDurationMs(unreadCount),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

