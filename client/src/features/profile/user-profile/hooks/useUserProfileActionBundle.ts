import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { FeedPost } from "@/lib/posts";
import type { PostVideoTrimUpload } from "@/lib/posts";
import type { StoryExpiresHours, StoryItem } from "@/lib/stories";
import type { PublicProfile } from "@/lib/users";
import { useUserProfileAvatarInteractions } from "./useUserProfileAvatarInteractions";
import { useUserProfilePinActions } from "./useUserProfilePinActions";
import { useUserProfilePostMutations } from "./useUserProfilePostMutations";
import { useUserProfilePrimaryActions } from "./useUserProfilePrimaryActions";
import { useUserProfilePullRefresh } from "./useUserProfilePullRefresh";
import { useUserProfileStoryInteractionActions } from "./useUserProfileStoryInteractionActions";
import { useUserProfileStoryPublishFlow } from "./useUserProfileStoryPublishFlow";

type ToastFn = (args: { title: string; variant?: "default" | "destructive"; duration?: number }) => void;

export function useUserProfileActionBundle(args: {
  id: string;
  isMe: boolean;
  normalizedRouteId: string;
  hasStories: boolean;
  hasProfileData: boolean;
  userId?: string;
  userPublicId?: number;
  apiProfile: PublicProfile | null;
  followLoading: boolean;
  apiStories: StoryItem[];
  likedStoryIds: Record<string, boolean>;
  likesCountByStoryId: Record<string, number>;
  pendingStoryFile: File | null;
  pendingStoryVideoTrim: PostVideoTrimUpload | null;
  storyCaption: string;
  storyExpiresInHours: StoryExpiresHours;
  queryClient: QueryClient;
  setLocation: (path: string) => void;
  setApiProfile: Dispatch<SetStateAction<PublicProfile | null>>;
  setPagePosts: Dispatch<SetStateAction<FeedPost[]>>;
  setPageStories: Dispatch<SetStateAction<StoryItem[]>>;
  setProfileError: Dispatch<SetStateAction<boolean>>;
  setProfileNotFound: Dispatch<SetStateAction<boolean>>;
  setSoftRefreshError: Dispatch<SetStateAction<string | null>>;
  setFollowLoading: Dispatch<SetStateAction<boolean>>;
  setLikedStoryIds: Dispatch<SetStateAction<Record<string, boolean>>>;
  setLikesCountByStoryId: Dispatch<SetStateAction<Record<string, number>>>;
  setActiveStoryIndex: Dispatch<SetStateAction<number | null>>;
  setProfilePinAdd: Dispatch<SetStateAction<{ kind: "post"; post: FeedPost } | { kind: "story"; storyId: string } | null>>;
  setPulseAvatarMenuOpen: Dispatch<SetStateAction<boolean>>;
  storyFileInputRef: RefObject<HTMLInputElement | null>;
  refetchPosts: () => Promise<unknown>;
  refetchStories: () => Promise<unknown>;
  toast: ToastFn;
  setAddingStory: Dispatch<SetStateAction<boolean>>;
  setStoryUploadPercent: Dispatch<SetStateAction<number | null>>;
  setPendingStoryFile: Dispatch<SetStateAction<File | null>>;
  setPendingStoryVideoTrim: Dispatch<SetStateAction<PostVideoTrimUpload | null>>;
  setShowStoryVideoTrimmer: Dispatch<SetStateAction<boolean>>;
  setShowStoryDurationPicker: Dispatch<SetStateAction<boolean>>;
  setStoryExpiresInHours: Dispatch<SetStateAction<StoryExpiresHours>>;
  setStoryCaption: Dispatch<SetStateAction<string>>;
}) {
  const { reactionMutation, deletePostMutation, savePostMutation } = useUserProfilePostMutations(args.toast);

  const { handleCopyLink, handleFollowToggle, handleStartChat } = useUserProfilePrimaryActions({
    isMe: args.isMe,
    id: args.id,
    normalizedRouteId: args.normalizedRouteId,
    userPublicId: args.userPublicId,
    apiProfile: args.apiProfile,
    followLoading: args.followLoading,
    queryClient: args.queryClient,
    setLocation: args.setLocation,
    setFollowLoading: args.setFollowLoading,
    setApiProfile: args.setApiProfile,
    setPagePosts: args.setPagePosts,
    setPageStories: args.setPageStories,
    toast: args.toast,
  });

  const { handleStoryReply, handleStoryLikeToggle, handleStoryShare, handleStoryArchive, handleStoryDelete } =
    useUserProfileStoryInteractionActions({
      userId: args.userId,
      queryClient: args.queryClient,
      toast: args.toast,
      likedStoryIds: args.likedStoryIds,
      likesCountByStoryId: args.likesCountByStoryId,
      setLikedStoryIds: args.setLikedStoryIds,
      setLikesCountByStoryId: args.setLikesCountByStoryId,
      setActiveStoryIndex: args.setActiveStoryIndex,
      refetchStories: args.refetchStories,
    });

  const { pinProfilePostMutation, clearProfilePinAdd, openProfilePinPost, openProfilePinStory, handleOpenPinnedPost, handleOpenPinnedStory } =
    useUserProfilePinActions({
      isMe: args.isMe,
      normalizedRouteId: args.normalizedRouteId,
      userId: args.userId,
      apiStories: args.apiStories,
      queryClient: args.queryClient,
      setLocation: args.setLocation,
      setProfilePinAdd: args.setProfilePinAdd,
      setActiveStoryIndex: args.setActiveStoryIndex,
      toast: args.toast,
    });

  const { handleStoryFileSelect, handleStoryVideoTrimConfirm, handleStoryTrimmerOpenChange, cancelStoryPublishFlow, handlePublishStory } =
    useUserProfileStoryPublishFlow({
      userId: args.userId,
      queryClient: args.queryClient,
      toast: args.toast,
      pendingStoryFile: args.pendingStoryFile,
      pendingStoryVideoTrim: args.pendingStoryVideoTrim,
      storyCaption: args.storyCaption,
      storyExpiresInHours: args.storyExpiresInHours,
      setAddingStory: args.setAddingStory,
      setStoryUploadPercent: args.setStoryUploadPercent,
      setPendingStoryFile: args.setPendingStoryFile,
      setPendingStoryVideoTrim: args.setPendingStoryVideoTrim,
      setShowStoryVideoTrimmer: args.setShowStoryVideoTrimmer,
      setShowStoryDurationPicker: args.setShowStoryDurationPicker,
      setStoryExpiresInHours: args.setStoryExpiresInHours,
      setStoryCaption: args.setStoryCaption,
    });

  const { clearAvatarLongPress, handleAvatarMainClick, handleAvatarPointerDownMe } = useUserProfileAvatarInteractions({
    isMe: args.isMe,
    hasStories: args.hasStories,
    setPulseAvatarMenuOpen: args.setPulseAvatarMenuOpen,
    setActiveStoryIndex: args.setActiveStoryIndex,
    storyFileInputRef: args.storyFileInputRef,
  });

  const { handlePullRefresh } = useUserProfilePullRefresh({
    id: args.id,
    isMe: args.isMe,
    userId: args.userId,
    hasProfileData: args.hasProfileData,
    queryClient: args.queryClient,
    refetchPosts: args.refetchPosts,
    refetchStories: args.refetchStories,
    setApiProfile: args.setApiProfile,
    setPagePosts: args.setPagePosts,
    setPageStories: args.setPageStories,
    setProfileError: args.setProfileError,
    setProfileNotFound: args.setProfileNotFound,
    setSoftRefreshError: args.setSoftRefreshError,
    toast: args.toast,
  });

  return {
    reactionMutation,
    deletePostMutation,
    savePostMutation,
    handlePullRefresh,
    handleCopyLink,
    handleFollowToggle,
    handleStartChat,
    handleStoryReply,
    handleStoryLikeToggle,
    handleStoryShare,
    handleStoryArchive,
    handleStoryDelete,
    handleStoryFileSelect,
    handleStoryVideoTrimConfirm,
    handleStoryTrimmerOpenChange,
    cancelStoryPublishFlow,
    handlePublishStory,
    clearAvatarLongPress,
    handleAvatarMainClick,
    handleAvatarPointerDownMe,
    pinProfilePostMutation,
    clearProfilePinAdd,
    openProfilePinPost,
    openProfilePinStory,
    handleOpenPinnedPost,
    handleOpenPinnedStory,
  };
}
