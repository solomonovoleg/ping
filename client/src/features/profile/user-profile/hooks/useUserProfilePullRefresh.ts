import { useCallback } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import type { FeedPost } from "@/lib/posts";
import type { StoryItem } from "@/lib/stories";
import type { PublicProfile } from "@/lib/users";
import { saveOtherProfilePageCache } from "@/lib/profile-offline-store";
import { applyOtherProfilePageData, fetchOtherProfilePage } from "../queries/fetch-other-profile-page";

export function useUserProfilePullRefresh(args: {
  id: string;
  isMe: boolean;
  userId?: string;
  hasProfileData: boolean;
  queryClient: QueryClient;
  refetchPosts: () => Promise<unknown>;
  refetchStories: () => Promise<unknown>;
  setApiProfile: Dispatch<SetStateAction<PublicProfile | null>>;
  setPagePosts: Dispatch<SetStateAction<FeedPost[]>>;
  setPageStories: Dispatch<SetStateAction<StoryItem[]>>;
  setProfileError: Dispatch<SetStateAction<boolean>>;
  setProfileNotFound: Dispatch<SetStateAction<boolean>>;
  setSoftRefreshError: Dispatch<SetStateAction<string | null>>;
  toast: (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;
}) {
  const {
    id,
    isMe,
    userId,
    hasProfileData,
    queryClient,
    refetchPosts,
    refetchStories,
    setApiProfile,
    setPagePosts,
    setPageStories,
    setProfileError,
    setProfileNotFound,
    setSoftRefreshError,
    toast,
  } = args;

  const handlePullRefresh = useCallback(async () => {
    if (isMe) {
      setSoftRefreshError(null);
      setProfileNotFound(false);
      await Promise.all([
        refetchPosts(),
        refetchStories(),
        userId ? queryClient.invalidateQueries({ queryKey: ["profile", "me", userId] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["profile-pins"] }),
        queryClient.invalidateQueries({ queryKey: ["posts", "saved", userId] }),
      ]);
      return;
    }
    if (!id.trim()) return;
    setProfileNotFound(false);
    setSoftRefreshError(null);
    try {
      const parsed = await fetchOtherProfilePage(id);
      if (!parsed) {
        if (hasProfileData) {
          const msg = "Профиль недоступен";
          setSoftRefreshError(msg);
          toast({ title: msg, variant: "destructive" });
          return;
        }
        setProfileError(false);
        setProfileNotFound(true);
        return;
      }
      setProfileError(false);
      setProfileNotFound(false);
      setSoftRefreshError(null);
      applyOtherProfilePageData(parsed, {
        setApiProfile,
        setPagePosts,
        setPageStories,
      });
      void saveOtherProfilePageCache(id, parsed);
    } catch {
      if (hasProfileData) {
        const msg = "Не удалось обновить профиль";
        setSoftRefreshError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      setProfileNotFound(false);
      setProfileError(true);
    }
    void queryClient.invalidateQueries({ queryKey: ["profile-pins"] });
  }, [hasProfileData, id, isMe, queryClient, refetchPosts, refetchStories, setApiProfile, setPagePosts, setPageStories, setProfileError, setProfileNotFound, setSoftRefreshError, toast, userId]);

  return { handlePullRefresh };
}
