import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUserProfile, fetchProfilePage, followUser, unfollowUser, type PublicProfile } from "@/lib/users";
import { startDm } from "@/lib/search";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPostsByAuthor, type FeedPost } from "@/lib/posts";
import {
  archiveStory,
  deleteStory,
  fetchStoriesByUser,
  createStory,
  fetchStoryViewers,
  likeStory,
  unlikeStory,
  type StoryItem,
  type StoryExpiresHours,
} from "@/lib/stories";
import { sendMessage, uploadChatMedia } from "@/lib/chat";
import { playLikeActionSound } from "@/lib/send-sound";
import { userProfileRu } from "./i18n.ru";
import { parseProfilePagePayload } from "./model/parse-profile-page";
import { deriveUserProfileLayoutFields } from "./model/derive-user-profile-layout";
import { useUserProfilePostMutations } from "./hooks/useUserProfilePostMutations";

const t = userProfileRu;

export function useUserProfilePage(paramsProp?: { id: string }) {
  const [, setLocation] = useLocation();
  const paramsFromRoute = useParams<{ id?: string }>();
  const fromPath =
    typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/(?:profile|id)\/([^/?#]+)/)?.[1] ?? "")
      : "";
  const id = (paramsProp?.id ?? paramsFromRoute?.id ?? fromPath) ?? "";
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const [postViewMode, setPostViewMode] = useState<"list" | "grid">("list");
  const [pulseAvatarMenuOpen, setPulseAvatarMenuOpen] = useState(false);
  const [profileMoreOpen, setProfileMoreOpen] = useState(false);
  const pulseScrollRef = useRef<HTMLDivElement>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [apiProfile, setApiProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [pagePosts, setPagePosts] = useState<FeedPost[]>([]);
  const [pageStories, setPageStories] = useState<StoryItem[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const [activeViewersStoryId, setActiveViewersStoryId] = useState<string | null>(null);
  const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
  const [showStoryDurationPicker, setShowStoryDurationPicker] = useState(false);
  const [storyExpiresInHours, setStoryExpiresInHours] = useState<StoryExpiresHours>(24);
  const [likedStoryIds, setLikedStoryIds] = useState<Record<string, boolean>>({});
  const [likesCountByStoryId, setLikesCountByStoryId] = useState<Record<string, number>>({});
  const avatarLongPressTimerRef = useRef<number | null>(null);
  const avatarLongPressHandledRef = useRef(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const [profilePinAdd, setProfilePinAdd] = useState<
    { kind: "post"; post: FeedPost } | { kind: "story"; storyId: string } | null
  >(null);
  const clearProfilePinAdd = useCallback(() => setProfilePinAdd(null), []);

  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const normalizedRouteId = id.trim().replace(/^@+/, "");
  const hasInvalidRouteId = !normalizedRouteId || ["undefined", "null", "nan"].includes(normalizedRouteId.toLowerCase());
  const isMe = id === "me";
  const authorId = isMe ? user?.id : apiProfile?.id;
  const authorIdReady = isMe ? authLoading === false : !!apiProfile;

  useEffect(() => {
    if (hasInvalidRouteId) setLocation("/posts");
  }, [hasInvalidRouteId, setLocation]);

  useEffect(() => {
    setCoverLoadError(false);
  }, [isMe ? (user as { coverUrl?: string | null })?.coverUrl : apiProfile?.coverUrl]);

  const {
    data: queryPosts = [],
    isFetching: postsFetching,
    isError: postsError,
    error: postsErrorDetail,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["posts", "author", authorId],
    queryFn: () => fetchPostsByAuthor(authorId!, 50),
    enabled: !!authorId && isMe,
    refetchOnMount: "always",
    staleTime: 0,
  });

  const { data: myProfileStats } = useQuery({
    queryKey: ["profile", "me", user?.id],
    queryFn: () => fetchUserProfile(user!.id),
    enabled: isMe && !!user?.id,
  });

  const { data: queryStories = [], refetch: refetchStories } = useQuery({
    queryKey: ["stories", authorId],
    queryFn: () => fetchStoriesByUser(authorId!),
    enabled: !!authorId && isMe,
  });

  const profilePosts = isMe ? queryPosts : pagePosts;
  const apiStories = isMe ? queryStories : pageStories;
  const hasStories = (apiStories ?? []).length > 0;
  const storyViewersCountById = (apiStories ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.id] = Number((s as { viewsCount?: number }).viewsCount ?? 0);
    return acc;
  }, {});

  useEffect(() => {
    const nextLiked: Record<string, boolean> = {};
    const nextLikesCount: Record<string, number> = {};
    for (const story of apiStories ?? []) {
      nextLiked[story.id] = story.isLiked === true;
      nextLikesCount[story.id] = Number(story.likesCount ?? 0);
    }
    setLikedStoryIds(nextLiked);
    setLikesCountByStoryId(nextLikesCount);
  }, [apiStories]);

  const { data: activeStoryViewers = [], isLoading: activeStoryViewersLoading } = useQuery({
    queryKey: ["stories", "viewers", activeViewersStoryId],
    queryFn: () => fetchStoryViewers(activeViewersStoryId!),
    enabled: !!activeViewersStoryId && isMe,
  });

  const { reactionMutation, deletePostMutation, savePostMutation } = useUserProfilePostMutations(toast);

  useEffect(() => {
    if (isMe || !id.trim()) return;
    setProfileLoading(true);
    setProfileError(false);
    setPagePosts([]);
    setPageStories([]);
    fetchProfilePage(id, 50)
      .then((data) => {
        try {
          const parsed = parseProfilePagePayload(data);
          if (!parsed) {
            setProfileError(true);
            return;
          }
          flushSync(() => {
            setApiProfile(parsed.profile);
            setPagePosts(parsed.posts);
            setPageStories(parsed.stories);
          });
        } catch {
          setProfileError(true);
        }
      })
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
  }, [isMe, id]);

  const handleCopyLink = useCallback(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const segment = isMe
      ? String(user?.publicId ?? "me")
      : apiProfile?.publicId != null
        ? String(apiProfile.publicId)
        : normalizedRouteId;
    const url = `${base}/profile/${segment}`;
    if (!navigator.clipboard?.writeText) {
      toast({ title: t.toast.copyUnavailable, variant: "destructive" });
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast({ title: t.toast.linkCopied });
      })
      .catch(() => {
        toast({ title: t.toast.copyLinkFailed, variant: "destructive" });
      });
  }, [apiProfile?.publicId, isMe, normalizedRouteId, toast, user?.publicId]);

  const handleFollowToggle = useCallback(async () => {
    if (!apiProfile || followLoading) return;
    setFollowLoading(true);
    try {
      if (apiProfile.isFollowing) {
        await unfollowUser(apiProfile.id);
        toast({ title: t.toast.unsubscribed });
      } else {
        await followUser(apiProfile.id);
        toast({ title: t.toast.subscribed });
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const next = await fetchUserProfile(id);
      if (next) setApiProfile(next);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t.toast.genericError, variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  }, [apiProfile, followLoading, id, queryClient, toast]);

  const handleStartChat = useCallback(async () => {
    if (!apiProfile?.canMessage) return;
    try {
      const chat = await startDm(apiProfile.id);
      setLocation(`/chat/${encodeURIComponent(chat.id)}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t.toast.chatStartFailed, variant: "destructive" });
    }
  }, [apiProfile, setLocation, toast]);

  const handleStoryReply = useCallback(
    async (payload: {
      storyId: string;
      authorId: string;
      text: string;
      story: { id: string; image: string; userName: string; userAvatar: string; time: string };
    }) => {
      if (!user?.id) {
        toast({ title: t.toast.storyReplyNeedLogin, variant: "destructive" });
        throw new Error(t.toast.storyReplyNeedLogin);
      }
      if (!payload.authorId || payload.authorId === user.id) {
        toast({ title: t.toast.storyReplySelf, variant: "destructive" });
        throw new Error(t.toast.storyReplySelf);
      }
      try {
        const chat = await startDm(payload.authorId);
        const storyPayload = {
          storyId: payload.story.id,
          mediaUrl: payload.story.image,
          authorId: payload.authorId,
          authorName: payload.story.userName,
          authorAvatar: payload.story.userAvatar,
          storyTimeLabel: payload.story.time,
          replyText: payload.text.trim(),
        };
        await sendMessage(chat.id, { type: "story_reply", content: JSON.stringify(storyPayload) });
        toast({ title: t.toast.storyReplySent });
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.toast.genericError;
        toast({ title: msg, variant: "destructive" });
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [toast, user?.id]
  );

  const handleStoryLikeToggle = useCallback(
    async (storyId: string, liked: boolean) => {
      const prevLiked = likedStoryIds[storyId] ?? false;
      const prevCount = likesCountByStoryId[storyId] ?? 0;
      const optimisticLiked = !liked;
      const optimisticCount = Math.max(0, prevCount + (liked ? -1 : 1));
      setLikedStoryIds((prev) => ({ ...prev, [storyId]: optimisticLiked }));
      setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: optimisticCount }));
      try {
        const result = liked ? await unlikeStory(storyId) : await likeStory(storyId);
        setLikedStoryIds((prev) => ({ ...prev, [storyId]: !!result.isLiked }));
        setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: Number(result.likesCount ?? optimisticCount) }));
        if (!liked && result.isLiked) {
          playLikeActionSound();
        }
      } catch (err) {
        setLikedStoryIds((prev) => ({ ...prev, [storyId]: prevLiked }));
        setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: prevCount }));
        toast({
          title: err instanceof Error ? err.message : t.toast.likeUpdateFailed,
          variant: "destructive",
        });
      }
    },
    [likedStoryIds, likesCountByStoryId, toast]
  );

  const handleStoryShare = useCallback(
    async (story: { id: string; image: string; userName: string; time: string }) => {
      const shareText = t.toast.storyShareTitle(story.userName);
      if (navigator.share) {
        await navigator.share({ title: shareText, text: shareText, url: story.image });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(story.image);
        toast({ title: t.toast.storyLinkCopied });
        return;
      }
      throw new Error(t.toast.shareFailed);
    },
    [toast]
  );

  const handleStoryArchive = useCallback(
    async (storyId: string) => {
      await archiveStory(storyId);
      toast({ title: t.toast.storyArchived });
      setActiveStoryIndex(null);
      await refetchStories();
    },
    [refetchStories, toast]
  );

  const handleStoryDelete = useCallback(
    async (storyId: string) => {
      await deleteStory(storyId);
      toast({ title: t.toast.storyDeleted });
      setActiveStoryIndex(null);
      await refetchStories();
    },
    [refetchStories, toast]
  );

  const openProfilePinPost = useCallback((post: FeedPost) => {
    setProfilePinAdd({ kind: "post", post });
  }, []);

  const openProfilePinStory = useCallback((storyId: string) => {
    setProfilePinAdd({ kind: "story", storyId });
  }, []);

  const handleOpenPinnedPost = useCallback(
    (postId: string) => {
      const seg = isMe ? "me" : encodeURIComponent(normalizedRouteId);
      setLocation(`/profile/${seg}/post/${postId}`);
    },
    [isMe, normalizedRouteId, setLocation]
  );

  const handleOpenPinnedStory = useCallback(
    (storyId: string) => {
      const list = apiStories ?? [];
      const idx = list.findIndex((s) => s.id === storyId);
      if (idx >= 0) setActiveStoryIndex(idx);
      else toast({ title: "Сториз недоступно или истекло", variant: "destructive" });
    },
    [apiStories, toast]
  );

  const handleStoryFileSelect = useCallback(
    (file: File | null) => {
      if (!file || !user?.id) return;
      setPendingStoryFile(file);
      setStoryExpiresInHours(24);
      setShowStoryDurationPicker(true);
    },
    [user?.id]
  );

  const handlePublishStory = useCallback(async () => {
    const file = pendingStoryFile;
    if (!file || !user?.id) return;
    setShowStoryDurationPicker(false);
    setAddingStory(true);
    try {
      const url = await uploadChatMedia(file);
      await createStory(url, { expiresInHours: storyExpiresInHours });
      queryClient.invalidateQueries({ queryKey: ["stories", user.id] });
      queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      toast({ title: t.toast.storyAddedHours(storyExpiresInHours) });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t.toast.publishError, variant: "destructive" });
    } finally {
      setPendingStoryFile(null);
      setAddingStory(false);
    }
  }, [pendingStoryFile, queryClient, storyExpiresInHours, toast, user?.id]);

  const clearAvatarLongPress = useCallback(() => {
    if (avatarLongPressTimerRef.current) {
      clearTimeout(avatarLongPressTimerRef.current);
      avatarLongPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAvatarLongPress(), [clearAvatarLongPress]);

  const handlePullRefresh = useCallback(async () => {
    if (isMe) {
      await Promise.all([
        refetchPosts(),
        refetchStories(),
        user?.id ? queryClient.invalidateQueries({ queryKey: ["profile", "me", user.id] }) : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ["profile-pins"] }),
      ]);
      return;
    }
    if (!id.trim()) return;
    try {
      const data = await fetchProfilePage(id, 50);
      const parsed = parseProfilePagePayload(data);
      if (!parsed) {
        setProfileError(true);
        return;
      }
      setProfileError(false);
      setApiProfile(parsed.profile);
      setPagePosts(parsed.posts);
      setPageStories(parsed.stories);
    } catch {
      setProfileError(true);
    }
    void queryClient.invalidateQueries({ queryKey: ["profile-pins"] });
  }, [id, isMe, queryClient, refetchPosts, refetchStories, user?.id]);

  const layout = deriveUserProfileLayoutFields({
    isMe,
    user,
    apiProfile,
    id,
    normalizedRouteId,
    coverLoadError,
  });

  const handleAvatarMainClick = useCallback(() => {
    setPulseAvatarMenuOpen(false);
    if (!isMe) {
      setActiveStoryIndex(0);
      return;
    }
    if (avatarLongPressHandledRef.current) {
      avatarLongPressHandledRef.current = false;
      return;
    }
    if (hasStories) {
      setActiveStoryIndex(0);
    } else {
      storyFileInputRef.current?.click();
    }
  }, [hasStories, isMe]);

  const handleAvatarPointerDownMe = useCallback(() => {
    avatarLongPressHandledRef.current = false;
    clearAvatarLongPress();
    avatarLongPressTimerRef.current = window.setTimeout(() => {
      avatarLongPressHandledRef.current = true;
      storyFileInputRef.current?.click();
    }, 420);
  }, [clearAvatarLongPress]);

  const pullRefreshDisabled =
    showStoryDurationPicker || !!activeViewersStoryId || activeStoryIndex !== null || profileMoreOpen;

  return {
    setLocation,
    hasInvalidRouteId,
    isMe,
    profileLoading,
    profileError,
    apiProfile,
    user,
    normalizedRouteId,
    pulseScrollRef,
    storyFileInputRef,
    activeTab,
    setActiveTab,
    postViewMode,
    setPostViewMode,
    pulseAvatarMenuOpen,
    setPulseAvatarMenuOpen,
    profileMoreOpen,
    setProfileMoreOpen,
    activeStoryIndex,
    setActiveStoryIndex,
    activeCommentPostId,
    setActiveCommentPostId,
    showReactionPicker,
    setShowReactionPicker,
    activeViewersStoryId,
    setActiveViewersStoryId,
    showStoryDurationPicker,
    setShowStoryDurationPicker,
    pendingStoryFile,
    setPendingStoryFile,
    storyExpiresInHours,
    setStoryExpiresInHours,
    coverLoadError,
    setCoverLoadError,
    addingStory,
    followLoading,
    displayName: layout.displayName,
    usernamePillText: layout.usernamePillText,
    avatarUrl: layout.avatarUrl,
    hasCover: layout.hasCover,
    resolvedCoverUrl: layout.resolvedCoverUrl,
    publicIdStr: layout.publicIdStr,
    genderChip: layout.genderChip,
    birthChip: layout.birthChip,
    cityChip: layout.cityChip,
    profileLinkTrim: layout.profileLinkTrim,
    profileLinkHref: layout.profileLinkHref,
    authorId,
    authorIdReady,
    profilePosts,
    apiStories,
    hasStories,
    storyViewersCountById,
    likedStoryIds,
    likesCountByStoryId,
    myProfileStats,
    postsFetching,
    postsError,
    postsErrorDetail,
    refetchPosts,
    refetchStories,
    activeStoryViewers,
    activeStoryViewersLoading,
    reactionMutation,
    deletePostMutation,
    savePostMutation,
    handlePullRefresh,
    pullRefreshDisabled,
    handleCopyLink,
    handleFollowToggle,
    handleStartChat,
    handleStoryReply,
    handleStoryLikeToggle,
    handleStoryShare,
    handleStoryArchive,
    handleStoryDelete,
    handleStoryFileSelect,
    handlePublishStory,
    clearAvatarLongPress,
    handleAvatarMainClick,
    handleAvatarPointerDownMe,
    profilePinAdd,
    clearProfilePinAdd,
    openProfilePinPost,
    openProfilePinStory,
    handleOpenPinnedPost,
    handleOpenPinnedStory,
  };
}
