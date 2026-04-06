import { useEffect, useMemo, useState } from "react";
import type { PushFeedItem } from "@/lib/push-feed";

function storageKey(userId: string): string {
  return `pingmoot:push-incoming-last-seen:${userId}`;
}

function readLastSeen(userId: string | undefined): string | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeLastSeen(userId: string, iso: string): void {
  try {
    window.localStorage.setItem(storageKey(userId), iso);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Сколько входящих Push новее отметки «раздел открыт» (localStorage по userId). */
export function countPushIncomingNewerThan(items: readonly PushFeedItem[], lastSeenIso: string | null): number {
  if (!lastSeenIso) return 0;
  const t = new Date(lastSeenIso).getTime();
  if (!Number.isFinite(t)) return 0;
  return items.reduce((acc, item) => {
    const ct = new Date(item.createdAt).getTime();
    return Number.isFinite(ct) && ct > t ? acc + 1 : acc;
  }, 0);
}

export function formatPushNewBadgeCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "99+";
  return String(n);
}

type UsePushIncomingLastSeenArgs = {
  userId: string | undefined;
  /** При переходе на вкладку Push сбрасываем бейдж (фиксируем «просмотрено»). */
  listSectionTab: string;
  incomingFeed: readonly PushFeedItem[];
};

/**
 * Бейдж «новые Push»: число карточек во входящей ленте с createdAt позже последнего открытия раздела Push.
 * Открытие вкладки Push обновляет отметку и обнуляет счётчик.
 */
export function usePushIncomingLastSeen({
  userId,
  listSectionTab,
  incomingFeed,
}: UsePushIncomingLastSeenArgs): { tabBadgeCount: number } {
  const [lastSeenIso, setLastSeenIso] = useState<string | null>(() => readLastSeen(userId));

  useEffect(() => {
    setLastSeenIso(readLastSeen(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(userId) && typeof e.newValue === "string") {
        setLastSeenIso(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  useEffect(() => {
    if (!userId || listSectionTab !== "push") return;
    let t = Date.now();
    for (const item of incomingFeed) {
      const ct = new Date(item.createdAt).getTime();
      if (Number.isFinite(ct)) t = Math.max(t, ct);
    }
    const iso = new Date(t).toISOString();
    writeLastSeen(userId, iso);
    setLastSeenIso(iso);
  }, [userId, listSectionTab, incomingFeed]);

  const newPushCount = useMemo(
    () => countPushIncomingNewerThan(incomingFeed, lastSeenIso),
    [incomingFeed, lastSeenIso],
  );

  /** Пока открыт раздел Push, бейдж на табе не показываем. */
  const tabBadgeCount = listSectionTab === "push" ? 0 : newPushCount;

  return { tabBadgeCount };
}
