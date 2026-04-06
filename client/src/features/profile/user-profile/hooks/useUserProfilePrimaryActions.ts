import { useCallback } from "react";
import { flushSync } from "react-dom";
import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import type { PublicProfile } from "@/lib/users";
import { followUser, unfollowUser, fetchProfilePage } from "@/lib/users";
import { startDm } from "@/lib/search";
import { buildChatPath } from "@/lib/chat-route";
import type { StoryItem } from "@/lib/stories";
import type { FeedPost } from "@/lib/posts";
import { userProfileRu } from "../i18n.ru";

const t = userProfileRu;

type ToastFn = (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;

export function useUserProfilePrimaryActions(args: {
  isMe: boolean;
  id: string;
  normalizedRouteId: string;
  userPublicId?: number;
  apiProfile: PublicProfile | null;
  followLoading: boolean;
  queryClient: QueryClient;
  setLocation: (path: string) => void;
  setFollowLoading: Dispatch<SetStateAction<boolean>>;
  setApiProfile: Dispatch<SetStateAction<PublicProfile | null>>;
  setPagePosts: Dispatch<SetStateAction<FeedPost[]>>;
  setPageStories: Dispatch<SetStateAction<StoryItem[]>>;
  toast: ToastFn;
}) {
  const handleCopyLink = useCallback(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const segment = args.isMe
      ? String(args.userPublicId ?? "me")
      : args.apiProfile?.publicId != null
        ? String(args.apiProfile.publicId)
        : args.normalizedRouteId;
    const url = `${base}/u/${segment}`;
    if (!navigator.clipboard?.writeText) {
      args.toast({ title: t.toast.copyUnavailable, variant: "destructive" });
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        args.toast({ title: t.toast.linkCopied, duration: 2000 });
      })
      .catch(() => {
        args.toast({ title: t.toast.copyLinkFailed, variant: "destructive" });
      });
  }, [args]);

  const handleFollowToggle = useCallback(async () => {
    if (!args.apiProfile || args.followLoading) return;
    args.setFollowLoading(true);
    const prevProfile = args.apiProfile;
    try {
      if (args.apiProfile.isFollowing) {
        await unfollowUser(args.apiProfile.id);
        args.toast({ title: t.toast.unsubscribed, duration: 2200 });
        args.setApiProfile((p) =>
          p
            ? {
                ...p,
                isFollowing: false,
                isMutualFollow: false,
                followersCount: Math.max(0, (p.followersCount ?? 0) - 1),
              }
            : p,
        );
      } else {
        await followUser(args.apiProfile.id);
        args.toast({ title: t.toast.subscribed, duration: 2200 });
        args.setApiProfile((p) =>
          p
            ? {
                ...p,
                isFollowing: true,
                isInMyContacts: true,
                isMutualFollow: !!p.isFollowedByTarget,
                followersCount: (p.followersCount ?? 0) + 1,
              }
            : p,
        );
      }
      void args.queryClient.invalidateQueries({ queryKey: ["posts"] });
      void args.queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void fetchProfilePage(args.id, 50).then((pack) => {
        if (!pack?.profile) return;
        flushSync(() => {
          args.setApiProfile(pack.profile);
          if (!args.isMe) {
            args.setPagePosts(pack.posts);
            args.setPageStories(Array.isArray(pack.stories) ? (pack.stories as StoryItem[]) : []);
          }
        });
      });
    } catch (e) {
      args.setApiProfile(prevProfile);
      args.toast({
        title: e instanceof Error ? e.message : t.toast.genericError,
        variant: "destructive",
      });
    } finally {
      args.setFollowLoading(false);
    }
  }, [args]);

  const handleStartChat = useCallback(async () => {
    if (!args.apiProfile?.canMessage) return;
    try {
      const chat = await startDm(args.apiProfile.id);
      args.setLocation(buildChatPath(chat, chat.id));
    } catch (e) {
      args.toast({
        title: e instanceof Error ? e.message : t.toast.chatStartFailed,
        variant: "destructive",
      });
    }
  }, [args]);

  return {
    handleCopyLink,
    handleFollowToggle,
    handleStartChat,
  };
}
