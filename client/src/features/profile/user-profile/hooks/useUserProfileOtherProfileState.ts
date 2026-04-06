import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { FeedPost } from "@/lib/posts";
import type { StoryItem } from "@/lib/stories";
import type { PublicProfile } from "@/lib/users";
import { getOtherProfilePageCache, saveOtherProfilePageCache } from "@/lib/profile-offline-store";
import { applyOtherProfilePageData, fetchOtherProfilePage } from "../queries/fetch-other-profile-page";

export function useUserProfileOtherProfileState(args: {
  id: string;
  isMe: boolean;
  hasInvalidRouteId: boolean;
  authLoading: boolean;
  normalizedRouteId: string;
  setApiProfile: Dispatch<SetStateAction<PublicProfile | null>>;
  setPagePosts: Dispatch<SetStateAction<FeedPost[]>>;
  setPageStories: Dispatch<SetStateAction<StoryItem[]>>;
  setProfileError: Dispatch<SetStateAction<boolean>>;
  setProfileNotFound: Dispatch<SetStateAction<boolean>>;
  setSoftRefreshError: Dispatch<SetStateAction<string | null>>;
  setProfileLoading: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    id,
    isMe,
    hasInvalidRouteId,
    authLoading,
    normalizedRouteId,
    setApiProfile,
    setPagePosts,
    setPageStories,
    setProfileError,
    setProfileNotFound,
    setSoftRefreshError,
    setProfileLoading,
  } = args;

  const [otherProfileBackgroundRefreshing, setOtherProfileBackgroundRefreshing] = useState(false);

  useEffect(() => {
    if (hasInvalidRouteId) return;

    if (isMe) {
      setApiProfile(null);
      setPagePosts([]);
      setPageStories([]);
      setProfileError(false);
      setProfileNotFound(false);
      setSoftRefreshError(null);
      setProfileLoading(false);
      setOtherProfileBackgroundRefreshing(false);
      return;
    }

    if (!id.trim()) return;
    if (authLoading && /^\d+$/u.test(normalizedRouteId)) {
      setProfileLoading(true);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setOtherProfileBackgroundRefreshing(false);
    setProfileError(false);
    setProfileNotFound(false);
    setSoftRefreshError(null);
    setPagePosts([]);
    setPageStories([]);

    void (async () => {
      const cached = await getOtherProfilePageCache(id);
      if (cancelled) return;
      if (cached) {
        applyOtherProfilePageData(cached, {
          setApiProfile,
          setPagePosts,
          setPageStories,
        });
        setProfileLoading(false);
        setOtherProfileBackgroundRefreshing(true);
      }

      try {
        const data = await fetchOtherProfilePage(id);
        if (cancelled) return;
        if (!data) {
          if (!cached) {
            setProfileError(false);
            setProfileNotFound(true);
          }
          setProfileLoading(false);
          return;
        }
        applyOtherProfilePageData(data, {
          setApiProfile,
          setPagePosts,
          setPageStories,
        });
        void saveOtherProfilePageCache(id, data);
        setProfileError(false);
        setProfileNotFound(false);
        setSoftRefreshError(null);
      } catch {
        if (!cancelled) {
          if (cached) {
            setProfileError(false);
            setProfileNotFound(false);
            setSoftRefreshError(null);
          } else {
            setProfileNotFound(false);
            setSoftRefreshError(null);
            setProfileError(true);
          }
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
          setOtherProfileBackgroundRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      setOtherProfileBackgroundRefreshing(false);
    };
  }, [authLoading, hasInvalidRouteId, id, isMe, normalizedRouteId, setApiProfile, setPagePosts, setPageStories, setProfileError, setProfileLoading, setProfileNotFound, setSoftRefreshError]);

  const refetchOtherProfile = useCallback(async () => {
    if (isMe || !id.trim()) return;
    setProfileError(false);
    setProfileNotFound(false);
    setSoftRefreshError(null);
    setOtherProfileBackgroundRefreshing(false);
    setProfileLoading(true);
    const cached = await getOtherProfilePageCache(id);
    if (cached) {
      applyOtherProfilePageData(cached, {
        setApiProfile,
        setPagePosts,
        setPageStories,
      });
      setProfileLoading(false);
    } else {
      setPagePosts([]);
      setPageStories([]);
      setApiProfile(null);
    }
    try {
      if (cached) setOtherProfileBackgroundRefreshing(true);
      const parsed = await fetchOtherProfilePage(id);
      if (!parsed) {
        setProfileError(false);
        setProfileNotFound(true);
        return;
      }
      applyOtherProfilePageData(parsed, {
        setApiProfile,
        setPagePosts,
        setPageStories,
      });
      void saveOtherProfilePageCache(id, parsed);
      setProfileError(false);
      setProfileNotFound(false);
      setSoftRefreshError(null);
    } catch {
      setProfileNotFound(false);
      setSoftRefreshError(null);
      setProfileError(true);
    } finally {
      setProfileLoading(false);
      setOtherProfileBackgroundRefreshing(false);
    }
  }, [id, isMe, setApiProfile, setPagePosts, setPageStories, setProfileError, setProfileLoading, setProfileNotFound, setSoftRefreshError]);

  return { refetchOtherProfile, otherProfileBackgroundRefreshing };
}
