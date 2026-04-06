import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { startDm } from "@/lib/search";
import { sendMessage } from "@/lib/chat";
import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { playLikeActionSound } from "@/lib/send-sound";
import { archiveStory, deleteStory, likeStory, unlikeStory } from "@/lib/stories";
import { userProfileRu } from "../i18n.ru";

const t = userProfileRu;

type ToastFn = (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;

type StoryReplyPayload = {
  storyId: string;
  authorId: string;
  text: string;
  story: { id: string; image: string; thumbnailUrl?: string; userName: string; userAvatar: string; time: string };
};

export function useUserProfileStoryInteractionActions(args: {
  userId?: string;
  queryClient: QueryClient;
  toast: ToastFn;
  likedStoryIds: Record<string, boolean>;
  likesCountByStoryId: Record<string, number>;
  setLikedStoryIds: Dispatch<SetStateAction<Record<string, boolean>>>;
  setLikesCountByStoryId: Dispatch<SetStateAction<Record<string, number>>>;
  setActiveStoryIndex: Dispatch<SetStateAction<number | null>>;
  refetchStories: () => Promise<unknown>;
}) {
  const handleStoryReply = useCallback(
    async (payload: StoryReplyPayload) => {
      if (!args.userId) {
        args.toast({ title: t.toast.storyReplyNeedLogin, variant: "destructive" });
        throw new Error(t.toast.storyReplyNeedLogin);
      }
      if (!payload.authorId || payload.authorId === args.userId) {
        args.toast({ title: t.toast.storyReplySelf, variant: "destructive" });
        throw new Error(t.toast.storyReplySelf);
      }
      try {
        const chat = await startDm(payload.authorId);
        const storyPayload = {
          storyId: payload.story.id,
          mediaUrl: payload.story.image,
          ...(payload.story.thumbnailUrl ? { thumbnailUrl: payload.story.thumbnailUrl } : {}),
          authorId: payload.authorId,
          authorName: payload.story.userName,
          authorAvatar: payload.story.userAvatar,
          storyTimeLabel: payload.story.time,
          replyText: payload.text.trim(),
        };
        await sendMessage(chat.id, { type: "story_reply", content: JSON.stringify(storyPayload) });
        void args.queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.toast.genericError;
        args.toast({ title: msg, variant: "destructive" });
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [args],
  );

  const handleStoryLikeToggle = useCallback(
    async (storyId: string, liked: boolean) => {
      const prevLiked = args.likedStoryIds[storyId] ?? false;
      const prevCount = args.likesCountByStoryId[storyId] ?? 0;
      const optimisticLiked = !liked;
      const optimisticCount = Math.max(0, prevCount + (liked ? -1 : 1));
      args.setLikedStoryIds((prev) => ({ ...prev, [storyId]: optimisticLiked }));
      args.setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: optimisticCount }));
      try {
        const result = liked ? await unlikeStory(storyId) : await likeStory(storyId);
        args.setLikedStoryIds((prev) => ({ ...prev, [storyId]: !!result.isLiked }));
        args.setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: Number(result.likesCount ?? optimisticCount) }));
        if (!liked && result.isLiked) playLikeActionSound();
        void args.queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      } catch (err) {
        args.setLikedStoryIds((prev) => ({ ...prev, [storyId]: prevLiked }));
        args.setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: prevCount }));
        args.toast({
          title: err instanceof Error ? err.message : t.toast.likeUpdateFailed,
          variant: "destructive",
        });
      }
    },
    [args],
  );

  const handleStoryShare = useCallback(
    async (story: { id: string; image: string; userName: string; time: string }) => {
      const shareText = t.toast.storyShareTitle(story.userName);
      if (navigator.share) {
        try {
          await navigator.share({ title: shareText, text: shareText, url: story.image });
        } catch (e) {
          if (isNavigatorShareCancelled(e)) return;
          throw e;
        }
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(story.image);
        args.toast({ title: t.toast.storyLinkCopied });
        return;
      }
      throw new Error(t.toast.shareFailed);
    },
    [args],
  );

  const handleStoryArchive = useCallback(
    async (storyId: string) => {
      try {
        await archiveStory(storyId);
        args.toast({ title: t.toast.storyArchived });
        args.setActiveStoryIndex(null);
        await args.refetchStories();
      } catch (err) {
        args.toast({
          title: err instanceof Error ? err.message : t.toast.genericError,
          variant: "destructive",
        });
      }
    },
    [args],
  );

  const handleStoryDelete = useCallback(
    async (storyId: string) => {
      try {
        await deleteStory(storyId);
        args.toast({ title: t.toast.storyDeleted });
        args.setActiveStoryIndex(null);
        await args.refetchStories();
      } catch (err) {
        args.toast({
          title: err instanceof Error ? err.message : t.toast.genericError,
          variant: "destructive",
        });
      }
    },
    [args],
  );

  return {
    handleStoryReply,
    handleStoryLikeToggle,
    handleStoryShare,
    handleStoryArchive,
    handleStoryDelete,
  };
}
