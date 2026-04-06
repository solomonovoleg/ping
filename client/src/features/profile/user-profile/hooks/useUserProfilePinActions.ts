import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, type QueryClient } from "@tanstack/react-query";
import { patchMyProfilePinnedPost } from "@/lib/profile-pinned-post";
import type { FeedPost } from "@/lib/posts";
import type { PublicProfile } from "@/lib/users";
import type { StoryItem } from "@/lib/stories";
import { userProfileRu } from "../i18n.ru";

const t = userProfileRu;

type ToastFn = (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;

export function useUserProfilePinActions(args: {
  isMe: boolean;
  normalizedRouteId: string;
  userId?: string;
  apiStories: StoryItem[];
  queryClient: QueryClient;
  setLocation: (path: string) => void;
  setProfilePinAdd: Dispatch<SetStateAction<{ kind: "post"; post: FeedPost } | { kind: "story"; storyId: string } | null>>;
  setActiveStoryIndex: Dispatch<SetStateAction<number | null>>;
  toast: ToastFn;
}) {
  const pinProfilePostMutation = useMutation({
    mutationFn: patchMyProfilePinnedPost,
    onSuccess: (data) => {
      if (args.userId) {
        args.queryClient.setQueryData<PublicProfile | null>(["profile", "me", args.userId], (old) =>
          old ? { ...old, pinnedPostId: data.pinnedPostId } : old,
        );
      }
      args.toast({
        title: data.pinnedPostId ? t.toast.postPinned : t.toast.postUnpinned,
      });
      void args.queryClient.invalidateQueries({ queryKey: ["profile", "me", args.userId] });
    },
    onError: (e) =>
      args.toast({
        title: e instanceof Error ? e.message : t.toast.postPinError,
        variant: "destructive",
      }),
  });

  const clearProfilePinAdd = useCallback(() => args.setProfilePinAdd(null), [args]);

  const openProfilePinPost = useCallback(
    (post: FeedPost) => {
      args.setProfilePinAdd({ kind: "post", post });
    },
    [args],
  );

  const openProfilePinStory = useCallback(
    (storyId: string) => {
      args.setProfilePinAdd({ kind: "story", storyId });
    },
    [args],
  );

  const handleOpenPinnedPost = useCallback(
    (postId: string) => {
      const seg = args.isMe ? "me" : encodeURIComponent(args.normalizedRouteId);
      args.setLocation(`/u/${seg}/p/${postId}`);
    },
    [args],
  );

  const handleOpenPinnedStory = useCallback(
    (storyId: string) => {
      const idx = args.apiStories.findIndex((story) => story.id === storyId);
      if (idx >= 0) args.setActiveStoryIndex(idx);
      else args.toast({ title: "Сториз недоступно или истекло", variant: "destructive" });
    },
    [args],
  );

  return {
    pinProfilePostMutation,
    clearProfilePinAdd,
    openProfilePinPost,
    openProfilePinStory,
    handleOpenPinnedPost,
    handleOpenPinnedStory,
  };
}
