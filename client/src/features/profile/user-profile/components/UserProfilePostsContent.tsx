import type { UseMutationResult } from "@tanstack/react-query";
import {
  Bookmark,
  Edit3,
  MessageSquare,
  MoreHorizontal,
  PenSquare,
  Play,
  Plus,
  Share2,
  Tag,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedPost } from "@/lib/posts";
import { PostMedia } from "@/components/PostMedia";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { PulseProfileThemedPostCard } from "@/features/profile/pulse-profile";
import { playLikeActionSound } from "@/lib/send-sound";
import { USER_PROFILE_REACTION_EMOJIS } from "../constants";
import { firstPostMediaUrl, isVideoMediaUrl, pulseProfilePostMeta } from "../utils/post-media";
import { PulseProfileCaption } from "./PulseProfileCaption";
import { userProfileRu } from "../i18n.ru";

const u = userProfileRu.posts;

type TabKey = "posts" | "saved" | "tagged";

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
  reactionMutation,
  showReactionPicker,
  setShowReactionPicker,
  setActiveCommentPostId,
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
  reactionMutation: UseMutationResult<unknown, Error, { postId: string; emoji: string | null }, unknown>;
  showReactionPicker: string | null;
  setShowReactionPicker: (id: string | null) => void;
  setActiveCommentPostId: (id: string | null) => void;
}) {
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
          const postHref = isMe
            ? `/profile/me/post/${post.id}`
            : `/profile/${encodeURIComponent(normalizedRouteId)}/post/${post.id}`;
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
    <div className="flex flex-col py-2">
      {profilePosts.map((post: FeedPost) => {
        const caption = post.text ?? "";
        const hasCaption = caption.trim().length > 0;
        return (
          <PulseProfileThemedPostCard
            key={post.id}
            displayName={displayName}
            avatarUrl={avatarUrl}
            authorSeed={authorId ?? ""}
            showVerified
            metaLine={pulseProfilePostMeta(post)}
            headerRight={
              isMe ? (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/profile/me/post/${post.id}`);
                    }}
                    className="rounded-full p-2 text-current opacity-70 transition-colors hover:bg-black/10 hover:opacity-100 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                      aria-label={u.editPost}
                  >
                    <Edit3 className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                        if (window.confirm(u.deleteConfirm)) {
                        deletePostMutation.mutate(post.id);
                      }
                    }}
                    className="rounded-full p-2 text-current opacity-70 transition-colors hover:bg-red-500/15 hover:text-red-500 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                    disabled={deletePostMutation.isPending}
                      aria-label={u.deletePost}
                  >
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="shrink-0 p-2 rounded-full text-current opacity-70 hover:opacity-100 hover:bg-black/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                    aria-label={u.postMenu}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              )
            }
          >
            <div className={cn("flex flex-col min-w-0 mb-3", hasCaption && "gap-3")}>
              {hasCaption ? <PulseProfileCaption>{caption}</PulseProfileCaption> : null}
              <PostMedia
                mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
                layout={post.mediaLayout ?? null}
                className={hasCaption ? "!mt-0" : undefined}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 relative">
                <div
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] transition-colors active:scale-95",
                    (post.myReaction ?? null)
                      ? "border-primary/30 bg-primary/10 text-foreground"
                      : "border-border/30 text-secondary-foreground hover:bg-secondary/80"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (post.myReaction) {
                      reactionMutation.mutate({ postId: post.id, emoji: null });
                    } else {
                      setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                    }
                  }}
                >
                  {post.reactions?.map((reaction: { emoji: string; count: number }, i: number) => {
                    if ((post.myReaction ?? null) === reaction.emoji) return null;
                    return (
                      <div key={i} className="flex items-center gap-1 pointer-events-none">
                        <span className="text-base leading-none">{reaction.emoji}</span>
                      </div>
                    );
                  })}
                  {(post.myReaction ?? null) && (
                    <div className="flex items-center gap-1 pointer-events-none">
                      <span className="text-base leading-none">{post.myReaction}</span>
                    </div>
                  )}
                  <span className="text-sm font-medium ml-1 pointer-events-none">
                    {post.reactions?.reduce((sum: number, r: { count: number }) => sum + r.count, 0) ?? 0}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                  }}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border bg-secondary transition-colors",
                    showReactionPicker === post.id
                      ? "text-primary border-primary/50 bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 border-border/30"
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>

                {showReactionPicker === post.id && (
                  <div className="absolute bottom-full left-0 mb-2 bg-background/95 backdrop-blur-xl border border-border shadow-lg rounded-full px-3 py-2 flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
                    {USER_PROFILE_REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                          playLikeActionSound();
                          reactionMutation.mutate({ postId: post.id, emoji });
                          setShowReactionPicker(null);
                        }}
                        className="text-2xl hover:scale-125 transition-transform active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setActiveCommentPostId(post.id)}
                  className="ml-auto flex items-center gap-1.5 rounded-full border border-border/30 bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
                >
                  <MessageSquare className="w-4 h-4" />
                  {post.commentsCount}
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={u.saveBookmark}
                >
                  <Bookmark className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    aria-label={u.share}
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </PulseProfileThemedPostCard>
        );
      })}
    </div>
  );
}
