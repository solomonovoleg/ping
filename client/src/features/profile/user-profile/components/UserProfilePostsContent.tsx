import type { UseMutationResult } from "@tanstack/react-query";
import type { PatchPinnedPostResult } from "@/lib/profile-pinned-post";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { buildReelsPostPath } from "@/lib/profile-route";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Copy,
  Edit3,
  Eye,
  Heart,
  Link2,
  FolderPlus,
  MessageSquare,
  MoreHorizontal,
  PenSquare,
  PinOff,
  Play,
  Pin,
  Plus,
  Share2,
  SmilePlus,
  Tag,
  Trash2,
  Flag,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import type { EdgeDisplayAudience, FeedPost } from "@/lib/posts";
import { PostLastCommentTeaser, pickNewestCommentPreview } from "@/features/comments/post-comments/PostLastCommentTeaser";
import { fetchSavedPosts, formatPostTime, sharePostToUser, updatePost } from "@/lib/posts";
import { edgeCreatorDestructiveToast } from "@/lib/edge-creator";
import { useAuth } from "@/contexts/AuthContext";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { DOUBLE_TAP_LIKE_EMOJI } from "@/lib/double-tap-like-reaction";
import { postHasUploadedVideo } from "@/lib/feed-video-post";
import { buildProfilePostPath } from "@/lib/profile-route";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { PostMedia } from "@/components/PostMedia";
import { FeedDoubleTapImageLayer } from "@/lib/reels-video";
import { PostExternalVideoEmbed } from "@/components/PostExternalVideoEmbed";
import { PostCaptionInlineParts } from "@/components/PostCaptionInlineParts";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { EdgePostAudienceSubmenu } from "@/features/edge-companion/components/EdgePostAudienceSubmenu";
import { buildEdgeCompanionOpenHref } from "@/features/edge-companion/edge-companion-navigation";
import { extractFirstExternalVideoUrl, isExternalVideoOnlyCaption } from "@/lib/post-external-video";
import { parseExternalVideoUrl } from "@/lib/external-video";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { PostsFeedSkeleton } from "@/features/posts/posts-feed-skeleton/PostsFeedSkeleton";
import { ProfilePostsAuthorPendingSkeleton, ProfilePostsGridSkeleton } from "./ProfilePostsTabSkeleton";
import { MotionBottomSheetPanel, MotionBottomSheetScrollArea } from "@/components/ui/motion-bottom-sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { PulseProfileThemedPostCard, usePulseProfileTheme } from "@/features/profile/pulse-profile";
import { playLikeActionSound } from "@/lib/send-sound";
import { USER_PROFILE_REACTION_EMOJIS } from "../constants";
import {
  firstPostMediaUrl,
  formatProfilePostMetric,
  isVideoMediaUrl,
  pulseProfilePostMetaParts,
} from "../utils/post-media";
import { userProfileRu } from "../i18n.ru";

const u = userProfileRu.posts;
const tToast = userProfileRu.toast;

type TabKey = "posts" | "saved" | "tagged";

function profilePostHref(post: FeedPost, wallIsMe: boolean) {
  return buildProfilePostPath({
    postId: post.id,
    linkCode: post.linkCode,
    isMe: wallIsMe,
    publicId: post.author?.publicId,
    userId: post.authorId,
    fallbackPath: "/posts",
  });
}

function profilePostPublicUrl(post: FeedPost, wallIsMe: boolean) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${profilePostHref(post, wallIsMe)}`;
}

/** Публичная ссылка на пост по данным автора (для «Сохранено» и чужих постов). */
function postPublicUrl(post: FeedPost, viewerId: string | undefined) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${buildProfilePostPath({
    postId: post.id,
    linkCode: post.linkCode,
    isMe: viewerId != null && post.authorId === viewerId,
    publicId: post.author?.publicId,
    userId: post.authorId,
    fallbackPath: "/posts",
  })}`;
}

function postDetailPath(post: FeedPost, viewerId: string | undefined) {
  return buildProfilePostPath({
    postId: post.id,
    linkCode: post.linkCode,
    isMe: viewerId != null && post.authorId === viewerId,
    publicId: post.author?.publicId,
    userId: post.authorId,
    fallbackPath: "/posts",
  });
}

export function UserProfilePostsContent({
  activeTab,
  postViewMode,
  profilePosts,
  isMe,
  normalizedRouteId,
  authorId,
  authorIdReady,
  postsError,
  postsErrorDetail,
  postsFetching,
  refetchPosts,
  setLocation,
  displayName,
  avatarUrl,
  deletePostMutation,
  savePostMutation,
  viewerCanSave,
  reactionMutation,
  showReactionPicker,
  setShowReactionPicker,
  setActiveCommentPostId,
  onOpenPinPost,
  pinnedPostId = null,
  pinProfilePostMutation,
  onReportForeignPost,
}: {
  activeTab: TabKey;
  postViewMode: "list" | "grid";
  profilePosts: FeedPost[];
  isMe: boolean;
  normalizedRouteId: string;
  authorId: string | undefined;
  authorIdReady: boolean;
  postsError: boolean;
  postsErrorDetail: Error | null;
  postsFetching: boolean;
  refetchPosts: () => void;
  setLocation: (path: string) => void;
  displayName: string;
  avatarUrl: string | null | undefined;
  deletePostMutation: UseMutationResult<unknown, Error, string, unknown>;
  savePostMutation: UseMutationResult<unknown, Error, { postId: string; save: boolean }, unknown>;
  viewerCanSave: boolean;
  reactionMutation: UseMutationResult<unknown, Error, { postId: string; emoji: string | null }, unknown>;
  showReactionPicker: string | null;
  setShowReactionPicker: (id: string | null) => void;
  setActiveCommentPostId: (id: string | null) => void;
  onOpenPinPost?: (post: FeedPost) => void;
  pinnedPostId?: string | null;
  pinProfilePostMutation: UseMutationResult<PatchPinnedPostResult, Error, string | null, unknown>;
  /** Чужая стена: жалоба на пост (store-moderation block-01). */
  onReportForeignPost?: (postId: string) => void;
}) {
  const { th } = usePulseProfileTheme();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [savedOverride, setSavedOverride] = useState<Record<string, boolean>>({});
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [doubleTapHeartPostId, setDoubleTapHeartPostId] = useState<string | null>(null);
  const doubleTapHeartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    };
  }, []);

  const triggerDoubleTapHeart = useCallback((postId: string) => {
    if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    setDoubleTapHeartPostId(postId);
    doubleTapHeartTimerRef.current = setTimeout(() => {
      setDoubleTapHeartPostId((cur) => (cur === postId ? null : cur));
      doubleTapHeartTimerRef.current = null;
    }, 460);
  }, []);

  const showSavedTab = activeTab === "saved";
  const {
    data: savedPosts = [],
    isFetching: savedFetching,
    isError: savedError,
    error: savedErrorDetail,
    refetch: refetchSaved,
  } = useQuery({
    queryKey: ["posts", "saved", user?.id],
    queryFn: () => fetchSavedPosts(50),
    enabled: isMe && showSavedTab,
  });

  const isSavedTabMe = showSavedTab && isMe;
  const displayPosts = isSavedTabMe ? savedPosts : profilePosts;
  const displayFetching = isSavedTabMe ? savedFetching : postsFetching;
  const displayError = isSavedTabMe ? savedError : postsError;
  const displayErrorDetail = isSavedTabMe ? savedErrorDetail : postsErrorDetail;
  const refetchDisplay = isSavedTabMe ? () => void refetchSaved() : () => void refetchPosts();

  const { data: contactsForShare = [] } = useQuery<ContactUser[]>({
    queryKey: ["contacts", "list"],
    queryFn: listContactsWithProfiles,
    enabled: sharePostId !== null && !!user,
  });

  const shareToUserMutation = useMutation({
    mutationFn: ({ postId, toUserId }: { postId: string; toUserId: string }) => sharePostToUser(postId, toUserId),
    onSuccess: (data) => {
      setSharePostId(null);
      toast({ title: "Пост отправлен в чат" });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      setLocation(`/chat/${encodeURIComponent(data.chatId)}`);
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" }),
  });

  const edgeAudienceMutation = useMutation({
    mutationFn: ({ postId, edgeDisplayAudience }: { postId: string; edgeDisplayAudience: EdgeDisplayAudience }) =>
      updatePost(postId, { edgeDisplayAudience }),
    onMutate: async ({ postId, edgeDisplayAudience }) => {
      if (!isMe || !authorId) return {};
      await queryClient.cancelQueries({ queryKey: ["posts", "author", authorId] });
      const previous = queryClient.getQueryData<FeedPost[]>(["posts", "author", authorId]);
      if (previous) {
        queryClient.setQueryData(
          ["posts", "author", authorId],
          previous.map((p) => (p.id === postId ? { ...p, edgeDisplayAudience } : p)),
        );
      }
      return { previous };
    },
    onSuccess: () => {
      toast({ title: "Кому виден EDGE обновлено" });
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e, _vars, ctx) => {
      if (isMe && authorId && ctx?.previous) {
        queryClient.setQueryData(["posts", "author", authorId], ctx.previous);
      }
      const t = edgeCreatorDestructiveToast(e);
      toast({ title: t.title, description: t.description, variant: "destructive" });
    },
  });

  const isPostSaved = useCallback(
    (post: FeedPost) => {
      if (isMe) return post.isSaved === true;
      const o = savedOverride[post.id];
      if (o !== undefined) return o;
      return post.isSaved === true;
    },
    [isMe, savedOverride]
  );

  const copyPostLinkForPost = useCallback(
    (post: FeedPost) => {
      const url = showSavedTab ? postPublicUrl(post, user?.id) : profilePostPublicUrl(post, isMe);
      if (!navigator.clipboard?.writeText) {
        toast({ title: tToast.copyUnavailable, variant: "destructive" });
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () => toast({ title: tToast.linkCopied }),
        () => toast({ title: tToast.copyLinkFailed, variant: "destructive" })
      );
    },
    [isMe, normalizedRouteId, showSavedTab, toast, user?.id]
  );

  const toggleSave = useCallback(
    (post: FeedPost) => {
      const next = !isPostSaved(post);
      savePostMutation.mutate(
        { postId: post.id, save: next },
        {
          onSuccess: () => {
            if (!isMe) setSavedOverride((prev) => ({ ...prev, [post.id]: next }));
          },
        }
      );
    },
    [isMe, isPostSaved, savePostMutation]
  );

  const shareTargetPost =
    sharePostId != null
      ? profilePosts.find((p) => p.id === sharePostId) ?? savedPosts.find((p) => p.id === sharePostId)
      : undefined;

  const shareSheet = (
    <AnimatePresence>
      {sharePostId ? (
        <motion.div
          className="fixed inset-0 z-[400] flex items-end bg-black/50 backdrop-blur-sm"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
          onClick={() => !shareToUserMutation.isPending && setSharePostId(null)}
        >
          <MotionBottomSheetPanel
            className="flex max-h-[min(72vh,640px)] w-full min-h-0 flex-col overflow-hidden rounded-t-[24px] border border-border/60 bg-background shadow-2xl uix-responsive-max-w"
            initial={prefersReducedMotion ? false : { y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
            onClick={(e) => e.stopPropagation()}
            disableSwipeDismiss={prefersReducedMotion}
            onDismiss={() => !shareToUserMutation.isPending && setSharePostId(null)}
            dragHandle={
              <div className="flex w-full shrink-0 justify-center pt-3 pb-2" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
            }
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 pb-3 pt-1">
              <p className="text-base font-bold">Поделиться</p>
              <button
                type="button"
                className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Закрыть"
                disabled={shareToUserMutation.isPending}
                onClick={() => setSharePostId(null)}
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <MotionBottomSheetScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+12px))]">
              {(() => {
                const sp = shareTargetPost;
                const shareUrl =
                  sp != null
                    ? `${window.location.origin}${buildProfilePostPath({
                        postId: sp.id,
                        linkCode: sp.linkCode,
                        isMe: sp.authorId === user?.id,
                        publicId: sp.author?.publicId,
                        userId: sp.authorId,
                        fallbackPath: "/posts",
                      })}`
                    : "";
                const shareTitle = sp
                  ? [sp.author?.displayName, sp.author?.surname].filter(Boolean).join(" ") || "Пост"
                  : "Пост";

                const runNativeShare = async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl });
                      setSharePostId(null);
                      return;
                    }
                    if (shareUrl && navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(shareUrl);
                      toast({ title: tToast.linkCopied });
                      setSharePostId(null);
                    }
                  } catch (e) {
                    if ((e as Error)?.name === "AbortError") return;
                    toast({ title: tToast.shareFailed, variant: "destructive" });
                  }
                };

                const copyLink = async () => {
                  if (!shareUrl) return;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast({ title: tToast.linkCopied });
                    setSharePostId(null);
                  } catch {
                    toast({ title: tToast.copyLinkFailed, variant: "destructive" });
                  }
                };

                if (!sp) {
                  return (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Пост не найден. Обновите страницу.
                    </p>
                  );
                }

                return (
                  <div className="flex flex-col gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => void runNativeShare()}
                      className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-xl border border-border/50 bg-secondary/40 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/60"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Share2 className="h-5 w-5" />
                      </span>
                      <span>Системное меню (соцсети, приложения…)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyLink()}
                      className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-xl border border-border/50 bg-secondary/25 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/45"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <Link2 className="h-5 w-5" />
                      </span>
                      <span>Копировать ссылку на пост</span>
                    </button>
                    <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Отправить в Ping
                    </p>
                    {contactsForShare.filter((c) => c.id !== user?.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Нет контактов — добавьте людей в разделе «Контакты».
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1 pb-2">
                        {contactsForShare
                          .filter((c) => c.id !== user?.id)
                          .map((c) => (
                            <li key={c.id}>
                              <button
                                type="button"
                                disabled={shareToUserMutation.isPending}
                                className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary/60"
                                onClick={() => shareToUserMutation.mutate({ postId: sharePostId, toUserId: c.id })}
                              >
                                <UserAvatar
                                  avatarUrl={c.avatarUrl ?? undefined}
                                  displayName={
                                    [c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`
                                  }
                                  seed={c.id}
                                  size={40}
                                  className="h-10 w-10 rounded-xl"
                                  pointerEventsNone
                                />
                                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                  {[c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`}
                                </span>
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
            </MotionBottomSheetScrollArea>
          </MotionBottomSheetPanel>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (activeTab === "tagged") {
    return (
      <>
        <div className="px-2 py-6">
          <ListEmptyState icon={Tag} title={u.taggedTitle} description={u.taggedDesc} />
        </div>
        {shareSheet}
      </>
    );
  }
  if (showSavedTab && !isMe) {
    return (
      <>
        <div className="px-2 py-6">
          <ListEmptyState icon={Bookmark} title={u.savedTitle} description={u.savedOtherProfileHint} />
        </div>
        {shareSheet}
      </>
    );
  }
  if (activeTab === "posts" && !authorId && authorIdReady === false) {
    return postViewMode === "grid" ? <ProfilePostsGridSkeleton /> : <ProfilePostsAuthorPendingSkeleton />;
  }
  if (displayError) {
    return (
      <ErrorWithRetry
        title={isSavedTabMe ? u.savedLoadErrorTitle : u.loadErrorTitle}
        description={displayErrorDetail instanceof Error ? displayErrorDetail.message : u.loadErrorDesc}
        retryLabel={u.retry}
        onRetry={refetchDisplay}
        className="min-h-[200px]"
      />
    );
  }
  if (displayPosts.length === 0 && !displayFetching) {
    if (isSavedTabMe) {
      return (
        <ListEmptyState
          icon={Bookmark}
          title={u.savedEmptyTitle}
          description={u.savedDesc}
          actionLabel="К ленте"
          onAction={() => setLocation("/posts")}
          secondaryActionLabel={u.refreshPosts}
          onSecondaryAction={refetchDisplay}
        />
      );
    }
    return (
      <ListEmptyState
        icon={PenSquare}
        title={u.emptyTitle}
        description={isMe ? u.emptyDescMe : u.emptyDescOther}
        actionLabel={isMe ? u.writePost : undefined}
        onAction={isMe ? () => setLocation("/create-post") : undefined}
        secondaryActionLabel={activeTab === "posts" ? u.refreshPosts : undefined}
        onSecondaryAction={activeTab === "posts" ? () => void refetchPosts() : undefined}
      />
    );
  }
  if (displayFetching && displayPosts.length === 0) {
    return activeTab === "posts" && postViewMode === "grid" ? (
      <ProfilePostsGridSkeleton />
    ) : (
      <PostsFeedSkeleton count={3} />
    );
  }
  if (activeTab === "posts" && postViewMode === "grid") {
    return (
      <div className="grid grid-cols-3 gap-px">
        {displayPosts.map((post: FeedPost) => {
          const thumbUrl = firstPostMediaUrl(post);
          const video = thumbUrl && isVideoMediaUrl(thumbUrl);
          const postHref = profilePostHref(post, isMe);
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setLocation(postHref)}
              className="relative w-full aspect-square overflow-hidden bg-black/25"
              aria-label={u.openPost}
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover [aspect-ratio:1/1]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/40">
                  <PenSquare className="w-6 h-6" />
                </div>
              )}
              {video ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-full bg-black/50 p-1.5">
                    <Play className="w-3 h-3 text-white" fill="white" />
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col">
      {displayPosts.map((post: FeedPost) => {
        const caption = post.text ?? "";
        const linkEmbedOn = post.linkEmbedEnabled !== false;
        const primaryExternalVideoUrl = linkEmbedOn ? extractFirstExternalVideoUrl(caption) : null;
        const maskExternalEmbed = primaryExternalVideoUrl ? parseExternalVideoUrl(primaryExternalVideoUrl) : null;
        const hasCaption =
          caption.trim().length > 0 && !(linkEmbedOn && isExternalVideoOnlyCaption(caption, primaryExternalVideoUrl));
        const meta = pulseProfilePostMetaParts(post);
        const viewerId = user?.id != null ? String(user.id) : "";
        const postAuthorId = post.authorId != null ? String(post.authorId) : "";
        const isPostMine = viewerId.length > 0 && postAuthorId === viewerId;
        const cardDisplayName = isSavedTabMe
          ? [post.author?.displayName, post.author?.surname].filter(Boolean).join(" ") ||
            `ID ${post.author?.publicId ?? ""}`
          : displayName;
        const cardAvatarUrl = isSavedTabMe ? post.author?.avatarUrl ?? null : avatarUrl;
        const cardAuthorSeed = isSavedTabMe ? post.authorId : (authorId ?? "");
        const sortedReactions = [...(post.reactions ?? [])].sort((a, b) => b.count - a.count);
        const topEmojis = sortedReactions.slice(0, 3);
        const extraTypes = Math.max(0, sortedReactions.length - 3);
        const reactionTotal = sortedReactions.reduce((s, r) => s + r.count, 0);
        const saved = isPostSaved(post);
        const sharesCount = post.sharesCount ?? 0;
        const lastComment = pickNewestCommentPreview(post.latestComments);
        const postPrimaryMedia = firstPostMediaUrl(post);
        const postHasVideo = postHasUploadedVideo(post);

        const fireDoubleTapLikeOnPost = () => {
          if (!user) return;
          void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
          playLikeActionSound();
          triggerDoubleTapHeart(post.id);
          const mine = post.myReaction;
          reactionMutation.mutate({
            postId: post.id,
            emoji: mine === DOUBLE_TAP_LIKE_EMOJI ? null : DOUBLE_TAP_LIKE_EMOJI,
          });
        };

        const menu = (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10"
                style={{ color: th.text }}
                aria-label={u.postMenuAria}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => copyPostLinkForPost(post)}>
                <Copy className="h-4 w-4" />
                {u.copyPostLink}
              </DropdownMenuItem>
              {user && onReportForeignPost && !isPostMine ? (
                <DropdownMenuItem
                  className="min-h-[var(--uix-touch-min)]"
                  onClick={() => onReportForeignPost(post.id)}
                >
                  <Flag className="h-4 w-4" />
                  {u.reportPost}
                </DropdownMenuItem>
              ) : null}
              {isPostMine ? (
                <>
                  <DropdownMenuItem
                    onClick={() => {
                      const isPinned = pinnedPostId === post.id;
                      pinProfilePostMutation.mutate(isPinned ? null : post.id);
                    }}
                    disabled={pinProfilePostMutation.isPending}
                  >
                    {pinnedPostId === post.id ? (
                      <PinOff className="h-4 w-4" />
                    ) : (
                      <Pin className="h-4 w-4" />
                    )}
                    {pinnedPostId === post.id ? u.unpinFromProfile : u.pinToProfile}
                  </DropdownMenuItem>
                  {onOpenPinPost ? (
                    <DropdownMenuItem
                      onClick={() => {
                        onOpenPinPost(post);
                      }}
                    >
                      <FolderPlus className="h-4 w-4" />
                      {u.addToPinFolder}
                    </DropdownMenuItem>
                  ) : null}
                  {post.edgeId ? (
                    <EdgePostAudienceSubmenu
                      current={post.edgeDisplayAudience}
                      disabled={
                        edgeAudienceMutation.isPending && edgeAudienceMutation.variables?.postId === post.id
                      }
                      onPick={(edgeDisplayAudience) => {
                        void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                          triggerLightHaptic(),
                        );
                        edgeAudienceMutation.mutate({ postId: post.id, edgeDisplayAudience });
                      }}
                    />
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => setLocation(`/create-post?edit=${encodeURIComponent(post.id)}`)}
                  >
                    <Edit3 className="h-4 w-4" />
                    {u.editPost}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (window.confirm(u.deleteConfirm)) deletePostMutation.mutate(post.id);
                    }}
                    disabled={deletePostMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    {u.deletePost}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );

        return (
          <PulseProfileThemedPostCard
            key={post.id}
            displayName={cardDisplayName}
            avatarUrl={cardAvatarUrl}
            authorSeed={cardAuthorSeed}
            showVerified
            metaKind={meta.kind}
            metaTime={meta.timeShort}
            headerRight={menu}
          >
            {post.edgeId ? (
              <div className="px-3 pb-2">
                <EdgeCompanionFeedCard
                  variant="feed"
                  userId={user?.id ?? "guest"}
                  edgeId={post.edgeId}
                  onOpen={() => {
                    if (!user?.id) {
                      toast({
                        title: "Войдите в аккаунт",
                        description: "Чтобы участвовать в кампании EDGE",
                        variant: "destructive",
                      });
                      return;
                    }
                    setLocation(
                      buildEdgeCompanionOpenHref(
                        post.edgeId!,
                        isMe ? "/profile/me" : `/profile/${encodeURIComponent(normalizedRouteId)}`,
                      ),
                    );
                  }}
                />
              </div>
            ) : null}

            <div className="relative w-full">
              {viewerCanSave ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSave(post);
                  }}
                  disabled={savePostMutation.isPending}
                  className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-transform active:scale-95 disabled:opacity-50"
                  style={{
                    background: isMe ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.5)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                  aria-label={saved ? u.removeBookmark : u.saveBookmark}
                >
                  {saved ? (
                    <Bookmark className="h-4 w-4 fill-white text-white" />
                  ) : (
                    <Plus className="h-4 w-4 stroke-[2.75]" />
                  )}
                </button>
              ) : null}
              <PostMedia
                mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
                layout={post.mediaLayout ?? null}
                edgeToEdge
                feedEagerImages
                feedVideoAutoplay
                feedReelsInteraction={user ? { onDoubleTapFire: fireDoubleTapLikeOnPost } : null}
                feedReelsDeferredOpen={
                  user && postHasVideo
                    ? () =>
                        setLocation(
                          buildReelsPostPath({
                            postId: post.id,
                            linkCode: post.linkCode,
                            isMe: post.authorId === user?.id,
                            publicId: post.author?.publicId,
                            userId: post.authorId,
                          }),
                        )
                    : undefined
                }
              />
              <AnimatePresence>
                {doubleTapHeartPostId === post.id ? (
                  <motion.div
                    key={`profile-double-tap-heart-${post.id}`}
                    initial={{ opacity: 0, scale: 0.72, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.06, y: -6 }}
                    transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: EASING_OUT_BEZIER }}
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                    aria-hidden
                  >
                    <Heart className="h-16 w-16 fill-rose-500 text-rose-500/95 drop-shadow-[0_8px_24px_rgba(244,63,94,0.55)]" />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {hasCaption || primaryExternalVideoUrl ? (
              <div className="space-y-2 px-3 pb-2 pt-2">
                {hasCaption ? (
                  user ? (
                    <FeedDoubleTapImageLayer
                      className="min-w-0"
                      onDoubleTap={fireDoubleTapLikeOnPost}
                      pulseOnDoubleTap={false}
                    >
                      <p
                        className="whitespace-pre-wrap text-[15px] font-normal leading-snug tracking-[-0.01em]"
                        style={{ color: th.text }}
                      >
                        <PostCaptionInlineParts
                          text={caption}
                          maskExternalEmbed={maskExternalEmbed}
                          onHashtagClick={() => setLocation("/posts")}
                          linkClassName="font-semibold text-primary underline decoration-primary/50 underline-offset-[3px] break-all"
                          hashtagClassName="font-semibold text-primary hover:underline underline-offset-2"
                        />
                      </p>
                    </FeedDoubleTapImageLayer>
                  ) : (
                    <p
                      className="whitespace-pre-wrap text-[15px] font-normal leading-snug tracking-[-0.01em]"
                      style={{ color: th.text }}
                    >
                      <PostCaptionInlineParts
                        text={caption}
                        maskExternalEmbed={maskExternalEmbed}
                        onHashtagClick={() => setLocation("/posts")}
                        linkClassName="font-semibold text-primary underline decoration-primary/50 underline-offset-[3px] break-all"
                        hashtagClassName="font-semibold text-primary hover:underline underline-offset-2"
                      />
                    </p>
                  )
                ) : null}
                {primaryExternalVideoUrl ? (
                  <PostExternalVideoEmbed
                    url={primaryExternalVideoUrl}
                    className="overflow-hidden rounded-xl border border-border/40"
                    autoplayInViewport
                  />
                ) : null}
              </div>
            ) : null}

            <div className="relative px-3 pb-2 pt-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                  <button
                    type="button"
                    className={cn(
                      "inline-flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-transform active:scale-[0.99] sm:flex-none sm:max-w-[min(100%,240px)]",
                      post.myReaction ? "border-primary/40 bg-primary/10" : "border-border/50 bg-secondary/20"
                    )}
                    style={{ color: th.text }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                      if (post.myReaction) {
                        reactionMutation.mutate({ postId: post.id, emoji: null });
                      } else {
                        setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                      }
                    }}
                  >
                    {topEmojis.map((r) => (
                      <span key={r.emoji} className="text-[16px] leading-none">
                        {r.emoji}
                      </span>
                    ))}
                    {post.myReaction && !topEmojis.some((r) => r.emoji === post.myReaction) ? (
                      <span className="text-[16px] leading-none">{post.myReaction}</span>
                    ) : null}
                    {extraTypes > 0 ? (
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                        style={{ background: th.surface, color: th.text, opacity: 0.9 }}
                      >
                        +{extraTypes}
                      </span>
                    ) : null}
                    {topEmojis.length === 0 && !post.myReaction ? (
                      <SmilePlus className="h-[18px] w-[18px] shrink-0 opacity-70" strokeWidth={2} aria-hidden />
                    ) : null}
                    <span
                      className={cn(
                        "text-[13px] font-semibold tabular-nums",
                        topEmojis.length === 0 && !post.myReaction ? "opacity-75" : ""
                      )}
                    >
                      {reactionTotal > 0 || post.myReaction ? reactionTotal : u.reactionsCta}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-background/90 shadow-sm min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] transition-colors",
                      showReactionPicker === post.id ? "border-primary/45 text-primary" : "border-border/50 text-muted-foreground"
                    )}
                    aria-label={u.addReactionAria}
                    onClick={(e) => {
                      e.stopPropagation();
                      void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                      setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                    }}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.25} />
                  </button>
                </div>

                <div
                  className="ml-auto flex shrink-0 items-center justify-end gap-0.5"
                  style={{ paddingRight: "max(0px, env(safe-area-inset-right, 0px))" }}
                >
                  <button
                    type="button"
                    className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 opacity-90 transition-colors active:scale-[0.98] hover:opacity-100"
                    style={{ color: th.text }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                      setActiveCommentPostId(post.id);
                    }}
                    aria-label={u.openComments}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    <span className="text-[12px] font-semibold tabular-nums">{formatProfilePostMetric(post.commentsCount)}</span>
                  </button>
                  <button
                    type="button"
                    className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 opacity-90 transition-colors active:scale-[0.98] hover:opacity-100"
                    style={{ color: th.text }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                      setSharePostId(post.id);
                    }}
                    aria-label={u.share}
                  >
                    <Share2 className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                    <span className="text-[12px] font-semibold tabular-nums">{formatProfilePostMetric(sharesCount)}</span>
                  </button>
                  <span
                    className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 opacity-75"
                    style={{ color: th.text }}
                    title={u.viewsHint}
                  >
                    <Eye className="h-4 w-4 shrink-0 opacity-75" strokeWidth={2} aria-hidden />
                    <span className="text-[12px] font-semibold tabular-nums">{formatProfilePostMetric(post.viewsCount)}</span>
                  </span>
                </div>
              </div>

              {showReactionPicker === post.id ? (
                <div
                  className="absolute bottom-full left-3 z-50 mb-2 flex max-w-[min(calc(100vw-2rem),360px)] flex-wrap items-center justify-center gap-1.5 rounded-2xl border px-3 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 sm:justify-start"
                  style={{
                    background: th.navBg,
                    borderColor: th.border,
                  }}
                >
                  {USER_PROFILE_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                        playLikeActionSound();
                        const mine = post.myReaction ?? null;
                        reactionMutation.mutate({
                          postId: post.id,
                          emoji: mine === emoji ? null : emoji,
                        });
                        setShowReactionPicker(null);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 active:scale-95"
                      aria-label={`${u.reactionAriaPrefix} ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {lastComment ? (
              <div className="mx-3 mb-2 mt-0 max-w-[calc(100%-1.5rem)]">
                <PostLastCommentTeaser
                  comment={lastComment}
                  commentsCount={post.commentsCount}
                  onOpen={() => setActiveCommentPostId(post.id)}
                  ariaLabel={u.commentTeaserAria(lastComment.user, post.commentsCount > 1)}
                  style={{ color: th.text }}
                  moreHint={u.commentTeaserMoreHint}
                />
              </div>
            ) : null}
          </PulseProfileThemedPostCard>
        );
      })}
    </div>
  );
}
