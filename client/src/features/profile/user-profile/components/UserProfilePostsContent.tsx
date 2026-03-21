import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Copy,
  Edit3,
  Eye,
  Forward,
  MessageCircle,
  MoreHorizontal,
  PenSquare,
  Play,
  Pin,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/posts";
import { PostMedia } from "@/components/PostMedia";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
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
import { PulseProfileCaption } from "./PulseProfileCaption";
import { userProfileRu } from "../i18n.ru";

const u = userProfileRu.posts;
const tToast = userProfileRu.toast;

type TabKey = "posts" | "saved" | "tagged";

function profilePostHref(isMe: boolean, normalizedRouteId: string, postId: string) {
  return isMe
    ? `/profile/me/post/${postId}`
    : `/profile/${encodeURIComponent(normalizedRouteId)}/post/${postId}`;
}

function profilePostPublicUrl(isMe: boolean, normalizedRouteId: string, postId: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const seg = isMe ? "me" : encodeURIComponent(normalizedRouteId);
  return `${base}/profile/${seg}/post/${postId}`;
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
}) {
  const { th } = usePulseProfileTheme();
  const { toast } = useToast();
  const [savedOverride, setSavedOverride] = useState<Record<string, boolean>>({});

  const isPostSaved = useCallback(
    (post: FeedPost) => {
      if (isMe) return post.isSaved === true;
      const o = savedOverride[post.id];
      if (o !== undefined) return o;
      return post.isSaved === true;
    },
    [isMe, savedOverride]
  );

  const copyPostLink = useCallback(
    (postId: string) => {
      const url = profilePostPublicUrl(isMe, normalizedRouteId, postId);
      if (!navigator.clipboard?.writeText) {
        toast({ title: tToast.copyUnavailable, variant: "destructive" });
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () => toast({ title: tToast.linkCopied }),
        () => toast({ title: tToast.copyLinkFailed, variant: "destructive" })
      );
    },
    [isMe, normalizedRouteId, toast]
  );

  const handleSharePost = useCallback(
    async (postId: string) => {
      const url = profilePostPublicUrl(isMe, normalizedRouteId, postId);
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({ url });
          return;
        } catch {
          /* fallback */
        }
      }
      copyPostLink(postId);
    },
    [copyPostLink, isMe, normalizedRouteId]
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

  if (activeTab === "tagged") {
    return (
      <div className="px-2 py-6">
        <ListEmptyState
          icon={Tag}
          title="Отметки"
          description="Раздел в разработке — скоро здесь будут публикации, где вас отметили."
        />
      </div>
    );
  }
  if (activeTab === "saved") {
    return (
      <div className="px-2 py-6">
        <ListEmptyState icon={Bookmark} title={u.savedTitle} description={u.savedDesc} />
      </div>
    );
  }
  if (activeTab === "posts" && postViewMode === "grid") {
    return (
      <div className="grid grid-cols-3 gap-0.5">
        {profilePosts.map((post: FeedPost) => {
          const thumbUrl = firstPostMediaUrl(post);
          const video = thumbUrl && isVideoMediaUrl(thumbUrl);
          const postHref = profilePostHref(isMe, normalizedRouteId, post.id);
          return (
            <button
              key={post.id}
              type="button"
              onClick={() => setLocation(postHref)}
              className="relative aspect-square overflow-hidden bg-black/25 min-h-[var(--uix-touch-min)]"
              aria-label={u.openPost}
            >
              {thumbUrl ? (
                <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
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
  if (!authorId && authorIdReady === false) {
    return (
      <LoadingProgress loading minHeight="160px" className="min-h-[160px]">
        <div className="min-h-[160px]" />
      </LoadingProgress>
    );
  }
  if (postsError) {
    return (
      <ErrorWithRetry
        title={u.loadErrorTitle}
        description={postsErrorDetail?.message ?? u.loadErrorDesc}
        retryLabel={u.retry}
        onRetry={() => refetchPosts()}
        className="min-h-[200px]"
      />
    );
  }
  if (profilePosts.length === 0 && !postsFetching) {
    return (
      <ListEmptyState
        icon={PenSquare}
        title={u.emptyTitle}
        description={isMe ? u.emptyDescMe : u.emptyDescOther}
        actionLabel={isMe ? u.writePost : undefined}
        onAction={isMe ? () => setLocation("/create-post") : undefined}
      />
    );
  }
  if (postsFetching && profilePosts.length === 0) {
    return (
      <LoadingProgress loading minHeight="160px" className="min-h-[160px]">
        <div className="min-h-[160px]" />
      </LoadingProgress>
    );
  }
  return (
    <div className="flex w-full min-w-0 flex-col">
      {profilePosts.map((post: FeedPost) => {
        const caption = post.text ?? "";
        const hasCaption = caption.trim().length > 0;
        const meta = pulseProfilePostMetaParts(post);
        const sortedReactions = [...(post.reactions ?? [])].sort((a, b) => b.count - a.count);
        const topEmojis = sortedReactions.slice(0, 3);
        const extraTypes = Math.max(0, sortedReactions.length - 3);
        const reactionTotal = sortedReactions.reduce((s, r) => s + r.count, 0);
        const saved = isPostSaved(post);
        const sharesCount = post.sharesCount ?? 0;

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
              <DropdownMenuItem onClick={() => copyPostLink(post.id)}>
                <Copy className="h-4 w-4" />
                {u.copyPostLink}
              </DropdownMenuItem>
              {isMe ? (
                <>
                  {onOpenPinPost ? (
                    <DropdownMenuItem
                      onClick={() => {
                        onOpenPinPost(post);
                      }}
                    >
                      <Pin className="h-4 w-4" />
                      В закреплённое
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem onClick={() => setLocation(profilePostHref(isMe, normalizedRouteId, post.id))}>
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
            displayName={displayName}
            avatarUrl={avatarUrl}
            authorSeed={authorId ?? ""}
            showVerified
            metaKind={meta.kind}
            metaTime={meta.timeShort}
            headerRight={menu}
          >
            {hasCaption ? (
              <div className="px-3 pb-2">
                <PulseProfileCaption>{caption}</PulseProfileCaption>
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
              />
            </div>

            <div className="relative px-3 pb-1 pt-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className="flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left transition-opacity active:opacity-80"
                  style={{ color: th.text }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                  }}
                >
                  {topEmojis.map((r) => (
                    <span key={r.emoji} className="text-lg leading-none">
                      {r.emoji}
                    </span>
                  ))}
                  {extraTypes > 0 ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                      style={{ background: th.surface, color: th.text, opacity: 0.85 }}
                    >
                      +{extraTypes}
                    </span>
                  ) : null}
                  <span className="text-[15px] font-semibold tabular-nums">{reactionTotal}</span>
                </button>

                <div
                  className="flex shrink-0 items-center gap-3 text-[13px] font-medium tabular-nums"
                  style={{ color: th.text }}
                >
                  <span className="flex items-center gap-1 opacity-90">
                    <Eye className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {formatProfilePostMetric(post.viewsCount)}
                  </span>
                  <button
                    type="button"
                    className="flex items-center gap-1 opacity-90 transition-opacity active:opacity-70"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCommentPostId(post.id);
                    }}
                    aria-label={u.openComments}
                  >
                    <MessageCircle className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {formatProfilePostMetric(post.commentsCount)}
                  </button>
                  <span className="flex items-center gap-1 opacity-90">
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    {formatProfilePostMetric(sharesCount)}
                  </span>
                </div>
              </div>

              {showReactionPicker === post.id ? (
                <div
                  className="absolute bottom-full left-0 z-50 mb-2 flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
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
                      className="text-2xl transition-transform hover:scale-125 active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSharePost(post.id);
                }}
                className="flex h-10 w-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full transition-transform active:scale-95"
                style={{
                  background: th.surface,
                  border: `1px solid ${th.border}`,
                  color: th.text,
                }}
                aria-label={u.share}
              >
                <Forward className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (viewerCanSave) toggleSave(post);
                }}
                disabled={!viewerCanSave || savePostMutation.isPending}
                className={cn(
                  "flex h-10 w-10 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full transition-transform active:scale-95",
                  !viewerCanSave && "opacity-40"
                )}
                style={{
                  background: th.surface,
                  border: `1px solid ${th.border}`,
                  color: th.text,
                }}
                aria-label={saved ? u.removeBookmark : u.saveBookmark}
              >
                <Bookmark className={cn("h-[18px] w-[18px]", saved && "fill-current")} strokeWidth={2.25} />
              </button>
            </div>
          </PulseProfileThemedPostCard>
        );
      })}
    </div>
  );
}
