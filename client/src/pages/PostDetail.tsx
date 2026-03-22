import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  MessageSquare,
  Eye,
  Trash2,
  FileX,
  SmilePlus,
  Plus,
  Check,
  Share2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { PostMedia } from "@/components/PostMedia";
import {
  fetchPost,
  formatPostTime,
  recordPostView,
  deletePost,
  addReaction,
  removeReaction,
  savePost,
  unsavePost,
  type FeedPost,
  type ReactionUser,
} from "@/lib/posts";
import { applyReactionOptimistic } from "@/lib/feed-query-cache";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { useAuth } from "@/contexts/AuthContext";
import CommentsModal from "@/components/CommentsModal";
import { ListEmptyState } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { useToast } from "@/hooks/use-toast";
import { buildProfilePath, buildProfilePostPath } from "@/lib/profile-route";
import { cn } from "@/lib/utils";
import { playLikeActionSound } from "@/lib/send-sound";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

export default function PostDetail({ params }: { params: { id: string; postId: string } }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userId = params.id;
  const postId = params.postId;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const profilePathFromRoute = buildProfilePath({ isMe: userId === "me", userId, fallbackPath: "/posts" });

  const { data: post, isLoading, error } = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId),
    enabled: !!postId,
  });

  const deletePostMutation = useMutation({
    mutationFn: (id: string) => deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Пост удалён" });
      setLocation(profilePathFromRoute);
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка удаления", variant: "destructive" }),
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ emoji }: { emoji: string | null }) => {
      if (!post?.id) return;
      if (emoji) await addReaction(post.id, emoji);
      else await removeReaction(post.id);
    },
    onMutate: async ({ emoji }) => {
      await queryClient.cancelQueries({ queryKey: ["post", postId] });
      const prev = queryClient.getQueryData<FeedPost | null>(["post", postId]);
      if (prev) {
        queryClient.setQueryData(["post", postId], applyReactionOptimistic(prev, emoji));
      }
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["post", postId], ctx.prev);
      toast({ title: e instanceof Error ? e.message : "Не удалось изменить реакцию", variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
  });

  const savePostMutation = useMutation({
    mutationFn: async ({ save }: { save: boolean }) => {
      if (!post?.id) return;
      if (save) await savePost(post.id);
      else await unsavePost(post.id);
    },
    onMutate: async ({ save }) => {
      await queryClient.cancelQueries({ queryKey: ["post", postId] });
      const prev = queryClient.getQueryData<FeedPost | null>(["post", postId]);
      if (prev) queryClient.setQueryData(["post", postId], { ...prev, isSaved: save });
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["post", postId], ctx.prev);
      toast({ title: e instanceof Error ? e.message : "Ошибка сохранения", variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["post", postId] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
  });

  useEffect(() => {
    if (post?.id && user?.id) {
      recordPostView(post.id).catch(() => {});
    }
  }, [post?.id, user?.id]);

  const shareUrl = useMemo(() => {
    if (!post?.id) return "";
    const path = buildProfilePostPath({
      postId: post.id,
      isMe: post.authorId === user?.id,
      publicId: post.author.publicId,
      userId: post.authorId,
      fallbackPath: "/posts",
    });
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [post, user?.id]);

  const handleShare = async () => {
    if (!post || !shareUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Пост",
          text: post.text?.slice(0, 200) || undefined,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Ссылка скопирована" });
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      toast({ title: "Не удалось поделиться", variant: "destructive" });
    }
  };

  if (isLoading || !postId) {
    return (
      <div className="flex flex-col h-full min-h-[200px] bg-background">
        <div className="uix-content-x py-[var(--uix-space-3)] flex items-center border-b border-border/40 bg-background/95 backdrop-blur">
          <button
            type="button"
            onClick={() => setLocation(profilePathFromRoute)}
            className="p-2 -ml-2 rounded-full hover:bg-secondary/80 text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center transition-colors"
            aria-label="Назад к профилю"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <LoadingProgress loading minHeight="200px" className="flex-1">
          <div className="min-h-[200px]" />
        </LoadingProgress>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-background">
        <div className="uix-content-x py-3 flex items-center border-b border-border/50">
          <button
            type="button"
            onClick={() => setLocation(profilePathFromRoute)}
            className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад к профилю"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <ListEmptyState
            icon={FileX}
            title="Пост не найден"
            description="Возможно, он был удалён или ссылка устарела."
            actionLabel="К профилю"
            onAction={() => setLocation(profilePathFromRoute)}
          />
        </div>
      </div>
    );
  }

  const authorName = [post.author.displayName, post.author.surname].filter(Boolean).join(" ") || `ID ${post.author.publicId}`;
  const postBody = post.text ?? "";
  const hasCaption = postBody.trim().length > 0;
  const reactionTotal = post.reactions?.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const topThreeReactionEmojis = [...(post.reactions ?? [])]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((r) => r.emoji);
  const sharesCount = post.sharesCount ?? 0;

  return (
    <div className="flex flex-col h-full bg-background pb-[calc(var(--uix-nav-bottom)+var(--uix-space-3))] w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="sticky top-0 z-10 uix-content-x py-[var(--uix-space-3)] border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[var(--uix-space-2)]">
          <div className="flex justify-start min-w-0">
            <button
              type="button"
              onClick={() => setLocation(profilePathFromRoute)}
              className="p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center shrink-0"
              aria-label="Назад к профилю"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <h1 className="text-center text-[17px] font-semibold leading-tight text-foreground truncate max-w-[min(180px,42vw)]">
            Пост
          </h1>
          <div className="flex justify-end min-w-0 items-center gap-1">
            {user && post.authorId !== user.id ? (
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border/50 bg-secondary/40 text-foreground transition-colors hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
                aria-label={post.isSaved ? "Убрать из сохранённого" : "Сохранить пост"}
                disabled={savePostMutation.isPending}
                onClick={() => savePostMutation.mutate({ save: !post.isSaved })}
              >
                {post.isSaved ? <Check className="h-5 w-5 text-primary" strokeWidth={2.25} /> : <Plus className="h-5 w-5" />}
              </button>
            ) : null}
            {post.authorId === user?.id ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Удалить пост?")) {
                    deletePostMutation.mutate(post.id);
                  }
                }}
                disabled={deletePostMutation.isPending}
                className="p-2 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center shrink-0"
                aria-label="Удалить пост"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            ) : !user ? (
              <span className="min-w-[var(--uix-touch-min)]" aria-hidden />
            ) : null}
          </div>
        </div>
      </div>

      <article className="uix-content-x py-[var(--uix-space-4)] border-b border-border/40">
        <div className="flex items-start justify-between gap-[var(--uix-space-3)] mb-[var(--uix-space-3)]">
          <button
            type="button"
            onClick={() =>
              setLocation(
                buildProfilePath({
                  isMe: post.authorId === user?.id,
                  publicId: post.author.publicId,
                  userId: post.authorId,
                  fallbackPath: "/posts",
                })
              )
            }
            className="flex min-w-0 flex-1 items-center gap-[var(--uix-space-3)] text-left group"
          >
            <UserAvatar
              avatarUrl={post.author.avatarUrl ?? undefined}
              displayName={authorName}
              seed={post.authorId}
              size={40}
              className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-border/30"
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-[15px] leading-tight group-hover:text-primary transition-colors">
                {authorName}
              </h2>
              <p className="mt-[var(--uix-space-1)] uix-text-caption text-muted-foreground">{formatPostTime(post.createdAt)}</p>
            </div>
          </button>
        </div>

        <div className={cn("flex flex-col min-w-0 mb-[var(--uix-space-4)]", hasCaption && "gap-[var(--uix-space-3)]")}>
          {hasCaption && (
            <p className="text-[15px] leading-snug tracking-[-0.01em] text-foreground whitespace-pre-wrap">{postBody}</p>
          )}
          <PostMedia
            mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
            layout={post.mediaLayout ?? null}
            className={hasCaption ? "!mt-0" : undefined}
          />
          {post.edgeId ? (
            <EdgeCompanionFeedCard
              variant="feed"
              className="mt-[var(--uix-space-3)]"
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
                setLocation(`/edge/companion?edgeId=${encodeURIComponent(post.edgeId!)}`);
              }}
            />
          ) : null}
        </div>

        <div className="relative border-t border-border/30 pt-[var(--uix-space-4)]">
          {user ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <button
                  type="button"
                  title={
                    post.reactionUsers && Object.keys(post.reactionUsers).length > 0
                      ? Object.entries(post.reactionUsers)
                          .flatMap(([emoji, users]) =>
                            (users as ReactionUser[]).map((u) =>
                              [emoji, [u.displayName, u.surname].filter(Boolean).join(" ") || "ID"].join(" ")
                            )
                          )
                          .join("; ") || undefined
                      : undefined
                  }
                  className={cn(
                    "inline-flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/25 px-2.5 py-2 text-left transition-transform active:scale-[0.99] sm:max-w-[min(100%,260px)]",
                    post.myReaction ? "border-primary/40 bg-primary/10" : ""
                  )}
                  onClick={() => {
                    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                    if (post.myReaction) {
                      reactionMutation.mutate({ emoji: null });
                    } else {
                      setShowReactionPicker((v) => !v);
                    }
                  }}
                >
                  {topThreeReactionEmojis.map((emoji, i) => (
                    <span key={`${emoji}-${i}`} className="text-[16px] leading-none">
                      {emoji}
                    </span>
                  ))}
                  {post.myReaction && !topThreeReactionEmojis.includes(post.myReaction) && (
                    <span className="text-[16px] leading-none">{post.myReaction}</span>
                  )}
                  {topThreeReactionEmojis.length === 0 && !post.myReaction && (
                    <SmilePlus className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
                  )}
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      topThreeReactionEmojis.length === 0 && !post.myReaction ? "text-muted-foreground" : "text-foreground/90"
                    )}
                  >
                    {reactionTotal > 0 || post.myReaction ? reactionTotal : "Реакции"}
                  </span>
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/90 shadow-sm min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] transition-colors",
                    showReactionPicker ? "border-primary/45 text-primary" : "text-muted-foreground"
                  )}
                  aria-label="Выбрать реакцию"
                  onClick={() => {
                    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                    setShowReactionPicker((v) => !v);
                  }}
                >
                  <Plus className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Войдите, чтобы ставить реакции</p>
          )}

          {showReactionPicker && user ? (
            <div className="absolute bottom-full left-0 z-[50] mb-2 flex w-full max-w-[min(100%,360px)] flex-wrap justify-center gap-1.5 rounded-2xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                    playLikeActionSound();
                    reactionMutation.mutate({ emoji });
                    setShowReactionPicker(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 active:scale-95"
                  aria-label={`Реакция ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-[var(--uix-space-5)] gap-y-[var(--uix-space-2)]">
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="inline-flex items-center gap-[var(--uix-space-2)] min-h-[var(--uix-touch-min)] rounded-full px-[var(--uix-space-2)] -ml-[var(--uix-space-2)] text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <MessageSquare className="h-[18px] w-[18px] shrink-0 opacity-80" />
              <span className="tabular-nums">{post.commentsCount}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleShare()}
              className="inline-flex items-center gap-[var(--uix-space-2)] min-h-[var(--uix-touch-min)] rounded-full px-[var(--uix-space-2)] text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <Share2 className="h-[18px] w-[18px] shrink-0 opacity-80" />
              <span className="tabular-nums">{sharesCount}</span>
            </button>
            <span className="inline-flex items-center gap-[var(--uix-space-2)] text-[14px] text-muted-foreground tabular-nums">
              <Eye className="h-[18px] w-[18px] shrink-0 opacity-80" />
              {post.viewsCount ?? 0}
            </span>
          </div>
        </div>
      </article>

      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={postId}
        postAuthorId={post?.authorId}
      />
    </div>
  );
}
