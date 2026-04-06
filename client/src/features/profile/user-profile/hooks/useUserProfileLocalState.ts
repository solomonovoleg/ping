import { useEffect, useRef, useState } from "react";
import type { FeedPost } from "@/lib/posts";
import type { StoryItem, StoryExpiresHours } from "@/lib/stories";
import type { PostVideoTrimUpload } from "@/lib/posts";
import type { PublicProfile } from "@/lib/users";

export function useUserProfileLocalState() {
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const [postViewMode, setPostViewMode] = useState<"list" | "grid">("list");

  useEffect(() => {
    if (activeTab !== "posts") setPostViewMode("list");
  }, [activeTab]);

  const [pulseAvatarMenuOpen, setPulseAvatarMenuOpen] = useState(false);
  const [profileMoreOpen, setProfileMoreOpen] = useState(false);
  const pulseScrollRef = useRef<HTMLDivElement>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [apiProfile, setApiProfile] = useState<PublicProfile | null>(null);

  // For foreign profiles start as loading to avoid first-paint "not found" flicker.
  const [profileLoading, setProfileLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    const m = window.location.pathname.match(/^\/(?:u|profile|id)\/([^/?#]+)/);
    const seg = (m?.[1] ?? "").trim().toLowerCase();
    return seg !== "me";
  });
  const [profileError, setProfileError] = useState(false);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [softRefreshError, setSoftRefreshError] = useState<string | null>(null);
  const [pagePosts, setPagePosts] = useState<FeedPost[]>([]);
  const [pageStories, setPageStories] = useState<StoryItem[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [storyUploadPercent, setStoryUploadPercent] = useState<number | null>(null);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const [activeViewersStoryId, setActiveViewersStoryId] = useState<string | null>(null);
  const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
  const [pendingStoryVideoTrim, setPendingStoryVideoTrim] = useState<PostVideoTrimUpload | null>(null);
  const [showStoryVideoTrimmer, setShowStoryVideoTrimmer] = useState(false);
  const [showStoryDurationPicker, setShowStoryDurationPicker] = useState(false);
  const [storyExpiresInHours, setStoryExpiresInHours] = useState<StoryExpiresHours>(24);
  const [storyCaption, setStoryCaption] = useState("");
  const storyFileInputRef = useRef<HTMLInputElement>(null);
  const [profilePinAdd, setProfilePinAdd] = useState<
    { kind: "post"; post: FeedPost } | { kind: "story"; storyId: string } | null
  >(null);

  return {
    activeTab,
    setActiveTab,
    postViewMode,
    setPostViewMode,
    pulseAvatarMenuOpen,
    setPulseAvatarMenuOpen,
    profileMoreOpen,
    setProfileMoreOpen,
    pulseScrollRef,
    activeStoryIndex,
    setActiveStoryIndex,
    activeCommentPostId,
    setActiveCommentPostId,
    showReactionPicker,
    setShowReactionPicker,
    apiProfile,
    setApiProfile,
    profileLoading,
    setProfileLoading,
    profileError,
    setProfileError,
    profileNotFound,
    setProfileNotFound,
    softRefreshError,
    setSoftRefreshError,
    pagePosts,
    setPagePosts,
    pageStories,
    setPageStories,
    followLoading,
    setFollowLoading,
    addingStory,
    setAddingStory,
    storyUploadPercent,
    setStoryUploadPercent,
    coverLoadError,
    setCoverLoadError,
    activeViewersStoryId,
    setActiveViewersStoryId,
    pendingStoryFile,
    setPendingStoryFile,
    pendingStoryVideoTrim,
    setPendingStoryVideoTrim,
    showStoryVideoTrimmer,
    setShowStoryVideoTrimmer,
    showStoryDurationPicker,
    setShowStoryDurationPicker,
    storyExpiresInHours,
    setStoryExpiresInHours,
    storyCaption,
    setStoryCaption,
    storyFileInputRef,
    profilePinAdd,
    setProfilePinAdd,
  };
}
