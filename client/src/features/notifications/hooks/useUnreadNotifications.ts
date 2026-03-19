import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchNotifications } from "@/lib/notifications";

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

  return {
    unreadCount,
    hasUnread: unreadCount > 0,
    pulseDurationMs: getPulseDurationMs(unreadCount),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

