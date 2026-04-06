import { useCallback, useEffect, useRef, useState } from "react";
import { API, apiFetch, toApiRequestError } from "@/lib/api-base";
import { isAdminModerationNavActive } from "@/lib/admin-moderation-nav";

function adminFetch(path: string, init?: RequestInit) {
  return apiFetch(`${API}${path}`, { ...init, credentials: "include" });
}

export type AdminNavBadgeCounts = {
  newUsers: number;
  mediaStudioPublished: number;
  openReports: number;
};

function isoNow(): string {
  return new Date().toISOString();
}

function storageKey(adminUserId: string): string {
  return `ping:admin-nav-badges-seen:v1:${adminUserId}`;
}

export type AdminNavBadgeSeen = {
  users: string;
  media: string;
  moderation: string;
};

function isIsoRecord(v: unknown): v is AdminNavBadgeSeen {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.users === "string" && typeof o.media === "string" && typeof o.moderation === "string";
}

export function loadNavBadgeSeen(adminUserId: string): AdminNavBadgeSeen {
  const key = storageKey(adminUserId);
  const initial = (): AdminNavBadgeSeen => {
    const n = isoNow();
    return { users: n, media: n, moderation: n };
  };
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isIsoRecord(parsed)) return parsed;
    }
  } catch {
    /* ignore */
  }
  const out = initial();
  try {
    localStorage.setItem(key, JSON.stringify(out));
  } catch {
    /* ignore */
  }
  return out;
}

export function saveNavBadgeSeen(adminUserId: string, seen: AdminNavBadgeSeen): void {
  try {
    localStorage.setItem(storageKey(adminUserId), JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

export async function fetchAdminNavBadgeCounts(seen: AdminNavBadgeSeen): Promise<AdminNavBadgeCounts> {
  const params = new URLSearchParams({
    usersSince: seen.users,
    mediaSince: seen.media,
    reportsSince: seen.moderation,
  });
  const res = await adminFetch(`/admin/nav-badge-counts?${params}`);
  if (!res.ok) throw await toApiRequestError(res);
  return res.json() as Promise<AdminNavBadgeCounts>;
}

export function formatAdminNavBadgeCount(n: number): string {
  if (n <= 0) return "";
  if (n > 99) return "+99";
  return `+${n}`;
}

export function useAdminNavBadges(adminUserId: string | undefined, location: string): {
  counts: AdminNavBadgeCounts;
  refresh: () => Promise<void>;
} {
  const [seen, setSeen] = useState<AdminNavBadgeSeen>(() => {
    if (!adminUserId) {
      const n = isoNow();
      return { users: n, media: n, moderation: n };
    }
    return loadNavBadgeSeen(adminUserId);
  });
  const [counts, setCounts] = useState<AdminNavBadgeCounts>({
    newUsers: 0,
    mediaStudioPublished: 0,
    openReports: 0,
  });
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!adminUserId) return;
    prevLocationRef.current = null;
    setSeen(loadNavBadgeSeen(adminUserId));
  }, [adminUserId]);

  const refresh = useCallback(async () => {
    if (!adminUserId) return;
    try {
      const c = await fetchAdminNavBadgeCounts(seen);
      setCounts(c);
    } catch {
      /* тихий fail: меню без бейджей */
    }
  }, [adminUserId, seen.users, seen.media, seen.moderation]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!adminUserId) return;
    const prev = prevLocationRef.current;
    prevLocationRef.current = location;

    setSeen((prevSeen) => {
      let next: AdminNavBadgeSeen | null = null;
      if (location === "/admin/users" && prev !== "/admin/users") {
        next = { ...prevSeen, users: isoNow() };
      }
      if (location === "/admin/media-studio" && prev !== "/admin/media-studio") {
        next = { ...(next ?? prevSeen), media: isoNow() };
      }
      const wasMod = prev !== null && isAdminModerationNavActive(prev);
      const isMod = isAdminModerationNavActive(location);
      if (isMod && !wasMod) {
        const base = next ?? prevSeen;
        next = { ...base, moderation: isoNow() };
      }
      if (!next) return prevSeen;
      saveNavBadgeSeen(adminUserId, next);
      setCounts((c) => ({
        newUsers: next.users !== prevSeen.users ? 0 : c.newUsers,
        mediaStudioPublished: next.media !== prevSeen.media ? 0 : c.mediaStudioPublished,
        openReports: next.moderation !== prevSeen.moderation ? 0 : c.openReports,
      }));
      return next;
    });
  }, [location, adminUserId]);

  useEffect(() => {
    if (!adminUserId) return;
    const t = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [adminUserId, refresh]);

  return { counts, refresh };
}
