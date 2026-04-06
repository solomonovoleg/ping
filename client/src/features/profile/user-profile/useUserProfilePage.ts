import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicProfile } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { FeedPost } from "@/lib/posts";
import type { StoryItem } from "@/lib/stories";
import { buildUserProfilePageResult } from "./model/build-user-profile-page-result";
import { deriveUserProfileLayoutFields } from "./model/derive-user-profile-layout";
import { useUserProfileActionBundle } from "./hooks/useUserProfileActionBundle";
import { useUserProfileDerivedPosts } from "./hooks/useUserProfileDerivedPosts";
import { useUserProfileLocalState } from "./hooks/useUserProfileLocalState";
import { useUserProfileOtherProfileState } from "./hooks/useUserProfileOtherProfileState";
import { useUserProfileQueries } from "./hooks/useUserProfileQueries";
import { useUserProfileRouteState } from "./hooks/useUserProfileRouteState";
import { useUserProfileStoryState } from "./hooks/useUserProfileStoryState";
import { useUserProfileUiEffects } from "./hooks/useUserProfileUiEffects";

export function useUserProfilePage(paramsProp?: { id: string }) {
  const { toast } = useToast();
  const local = useUserProfileLocalState();

  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { id, setLocation, normalizedRouteId, hasInvalidRouteId, isMe } = useUserProfileRouteState({
    paramsProp,
    me: user,
    authLoading,
  });
  const authorId = isMe ? user?.id : local.apiProfile?.id;
  const authorIdReady = isMe ? authLoading === false : !!local.apiProfile;

  useUserProfileUiEffects({
    hasInvalidRouteId,
    setLocation,
    isMe,
    ownCoverUrl: (user as { coverUrl?: string | null })?.coverUrl,
    otherCoverUrl: local.apiProfile?.coverUrl,
    setCoverLoadError: local.setCoverLoadError,
  });

  const queries = useUserProfileQueries({
    authorId,
    isMe,
    userId: user?.id,
    activeViewersStoryId: local.activeViewersStoryId,
  });

  const profilePinnedPostId = isMe
    ? (queries.myProfileStats?.pinnedPostId ?? null)
    : (local.apiProfile?.pinnedPostId ?? null);

  const derivedPosts = useUserProfileDerivedPosts({
    isMe,
    queryPosts: queries.queryPosts,
    pagePosts: local.pagePosts,
    profilePinnedPostId,
    savedPostsForCommentLookup: queries.savedPostsForCommentLookup,
  });

  const storyState = useUserProfileStoryState({
    isMe,
    queryStories: queries.queryStories,
    pageStories: local.pageStories,
  });

  const { refetchOtherProfile, otherProfileBackgroundRefreshing } = useUserProfileOtherProfileState({
    id,
    isMe,
    hasInvalidRouteId,
    authLoading,
    normalizedRouteId,
    setApiProfile: local.setApiProfile,
    setPagePosts: local.setPagePosts,
    setPageStories: local.setPageStories,
    setProfileError: local.setProfileError,
    setProfileNotFound: local.setProfileNotFound,
    setSoftRefreshError: local.setSoftRefreshError,
    setProfileLoading: local.setProfileLoading,
  });

  const actions = useUserProfileActionBundle({
    id,
    isMe,
    normalizedRouteId,
    hasStories: storyState.hasStories,
    hasProfileData: !!local.apiProfile,
    userId: user?.id,
    userPublicId: user?.publicId,
    apiProfile: local.apiProfile,
    followLoading: local.followLoading,
    apiStories: storyState.apiStories,
    likedStoryIds: storyState.likedStoryIds,
    likesCountByStoryId: storyState.likesCountByStoryId,
    pendingStoryFile: local.pendingStoryFile,
    pendingStoryVideoTrim: local.pendingStoryVideoTrim,
    storyCaption: local.storyCaption,
    storyExpiresInHours: local.storyExpiresInHours,
    queryClient,
    setLocation,
    setApiProfile: local.setApiProfile,
    setPagePosts: local.setPagePosts,
    setPageStories: local.setPageStories,
    setProfileError: local.setProfileError,
    setProfileNotFound: local.setProfileNotFound,
    setSoftRefreshError: local.setSoftRefreshError,
    setFollowLoading: local.setFollowLoading,
    setLikedStoryIds: storyState.setLikedStoryIds,
    setLikesCountByStoryId: storyState.setLikesCountByStoryId,
    setActiveStoryIndex: local.setActiveStoryIndex,
    setProfilePinAdd: local.setProfilePinAdd,
    setPulseAvatarMenuOpen: local.setPulseAvatarMenuOpen,
    storyFileInputRef: local.storyFileInputRef,
    refetchPosts: queries.refetchPosts,
    refetchStories: queries.refetchStories,
    toast,
    setAddingStory: local.setAddingStory,
    setStoryUploadPercent: local.setStoryUploadPercent,
    setPendingStoryFile: local.setPendingStoryFile,
    setPendingStoryVideoTrim: local.setPendingStoryVideoTrim,
    setShowStoryVideoTrimmer: local.setShowStoryVideoTrimmer,
    setShowStoryDurationPicker: local.setShowStoryDurationPicker,
    setStoryExpiresInHours: local.setStoryExpiresInHours,
    setStoryCaption: local.setStoryCaption,
  });

  const layout = deriveUserProfileLayoutFields({
    isMe,
    user,
    apiProfile: local.apiProfile,
    id,
    normalizedRouteId,
    coverLoadError: local.coverLoadError,
  });

  const pullRefreshDisabled =
    local.showStoryVideoTrimmer ||
    local.showStoryDurationPicker ||
    !!local.activeViewersStoryId ||
    local.activeStoryIndex !== null ||
    local.profileMoreOpen;

  return buildUserProfilePageResult({
    route: {
      setLocation,
      hasInvalidRouteId,
      isMe,
      normalizedRouteId,
    },
    view: {
      ...local,
      profileLoading: local.profileLoading,
      profileError: local.profileError,
      profileNotFound: local.profileNotFound,
      apiProfile: local.apiProfile,
      user,
      pullRefreshDisabled,
      otherProfileBackgroundRefreshing,
    },
    layout,
    data: {
      authorId,
      authorIdReady,
      ...queries,
      ...storyState,
      profilePosts: derivedPosts.profilePosts,
      postsForCommentLookup: derivedPosts.postsForCommentLookup,
      profilePinnedPreview: derivedPosts.profilePinnedPreview,
      profilePostsRaw: derivedPosts.profilePostsRaw,
      profilePinAdd: local.profilePinAdd,
      profilePinnedPostId,
    },
    actions: {
      ...actions,
      refetchOtherProfile,
    },
  });
}
