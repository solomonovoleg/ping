import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  ChevronLeft,
  Heart,
  MessageSquare,
  Eye,
  Trash2,
  PenSquare,
  FileX,
  SmilePlus,
  Plus,
  Check,
  Share2,
  MoreHorizontal,
  Flag,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { PostMedia } from "@/components/PostMedia";
import { FeedDoubleTapImageLayer } from "@/lib/reels-video";
import { PostExternalVideoEmbed } from "@/components/PostExternalVideoEmbed";
import { PostCaptionInlineParts } from "@/components/PostCaptionInlineParts";
import { extractFirstExternalVideoUrl, isExternalVideoOnlyCaption } from "@/lib/post-external-video";
import { parseExternalVideoUrl } from "@/lib/external-video";
import {
  fetchPost,
  formatPostTime,
  recordPostViewBestEffort,
  deletePost,
  addReaction,
  removeReaction,
  savePost,
  unsavePost,
  updatePost,
  type EdgeDisplayAudience,
  type FeedPost,
  type ReactionUser,
} from "@/lib/posts";
import { applyReactionOptimistic } from "@/lib/feed-query-cache";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { EdgePostAudienceSubmenu } from "@/features/edge-companion/components/EdgePostAudienceSubmenu";
import { buildEdgeCompanionOpenHref } from "@/features/edge-companion/edge-companion-navigation";
import { useAuth } from "@/contexts/AuthContext";
import CommentsModal from "@/components/CommentsModal";
import { PostLastCommentTeaser, pickNewestCommentPreview } from "@/features/comments/post-comments/PostLastCommentTeaser";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { PostDetailSkeleton } from "@/features/posts/post-detail-skeleton/PostDetailSkeleton";
import { useToast } from "@/hooks/use-toast";
import { buildProfilePath, buildProfilePostPath, buildReelsPostPath } from "@/lib/profile-route";
import { cn } from "@/lib/utils";
import { DOUBLE_TAP_LIKE_EMOJI } from "@/lib/double-tap-like-reaction";
import { postHasUploadedVideo } from "@/lib/feed-video-post";
import { EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { playLikeActionSound } from "@/lib/send-sound";
import { edgeCreatorDestructiveToast } from "@/lib/edge-creator";
import { ReportContentDialog } from "@/features/store-moderation/block-01-ugc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

export default function PostDetail({ params }: { params: { id: string; postId: string } }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userId = params.id;
  const postId = params.postId;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [deepLinkCommentId, setDeepLinkCommentId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [postReportOpen, setPostReportOpen] = useState(false);
  const profilePathFromRoute = buildProfilePath({ isMe: userId === "me", userId, fallbackPath: "/posts" });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = new URLSearchParams(window.location.search);
    const shouldOpenComments = search.get("openComments") === "1";
    const targetCommentId = search.get("commentId")?.trim() || null;
    if (!shouldOpenComments && !targetCommentId) return;
    setCommentsOpen(true);
    setDeepLinkCommentId(targetCommentId);
    search.delete("openComments");
    search.delete("commentId");
    const q = search.toString();
    setLocation(`${window.location.pathname}${q ? `?${q}` : ""}`, { replace: true } as { replace?: boolean });
  }, [setLocation]);

  const { data: post, isLoading, isError, error, refetch } = useQuery({
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

  const edgeAudienceMutation = useMutation({
    mutationFn: ({ postId, edgeDisplayAudience }: { postId: string; edgeDisplayAudience: EdgeDisplayAudience }) =>
      updatePost(postId, { edgeDisplayAudience }),
    onMutate: async ({ postId, edgeDisplayAudience }) => {
      await queryClient.cancelQueries({ queryKey: ["post", postId] });
      const prev = queryClient.getQueryData<FeedPost | null>(["post", postId]);
      if (prev) {
        queryClient.setQueryData(["post", postId], { ...prev, edgeDisplayAudience });
      }
      return { prev };
    },
    onError: (e, vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["post", vars.postId], ctx.prev);
      const t = edgeCreatorDestructiveToast(e);
      toast({ title: t.title, description: t.description, variant: "destructive" });
    },
    onSettled: (_d, _e, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["post", vars.postId] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
    onSuccess: () => {
      toast({ title: "Кому виден EDGE обновлено" });
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
      recordPostViewBestEffort(post.id);
    }
  }, [post?.id, user?.id]);

  /** Старый URL с UUID в пути → короткий `/u/…/p/{linkCode}` (replace). */
  useEffect(() => {
    if (!post?.linkCode || !postId) return;
    if (postId === post.linkCode) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return;
    const next = buildProfilePostPath({
      postId: post.id,
      linkCode: post.linkCode,
      isMe: userId === "me",
      publicId: post.author.publicId,
      userId: post.authorId,
      fallbackPath: "/posts",
    });
    const search = typeof window !== "undefined" ? window.location.search : "";
    setLocation(`${next}${search}`, { replace: true } as { replace?: boolean });
  }, [post, postId, userId, setLocation]);

  const shareUrl = useMemo(() => {
    if (!post?.id) return "";
    const path = buildProfilePostPath({
      postId: post.id,
      linkCode: post.linkCode,
      isMe: String(post.authorId) === String(user?.id ?? ""),
      publicId: post.author.publicId,
      userId: post.authorId,
      fallbackPath: "/posts",
    });
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  }, [post, user?.id]);

  const postBodyForEmbed = post?.text ?? "";
  const primaryExternalVideoUrl = useMemo(() => {
    if (post?.linkEmbedEnabled === false) return null;
    return extractFirstExternalVideoUrl(postBodyForEmbed);
  }, [post?.linkEmbedEnabled, postBodyForEmbed]);
  const maskExternalEmbed = useMemo(
    () => (primaryExternalVideoUrl ? parseExternalVideoUrl(primaryExternalVideoUrl) : null),
    [primaryExternalVideoUrl],
  );

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

  const prefersReducedMotion = usePrefersReducedMotion();
  const [doubleTapHeartVisible, setDoubleTapHeartVisible] = useState(false);
  const doubleTapHeartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerDoubleTapHeart = useCallback(() => {
    if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    setDoubleTapHeartVisible(true);
    doubleTapHeartTimerRef.current = setTimeout(() => {
      setDoubleTapHeartVisible(false);
      doubleTapHeartTimerRef.current = null;
    }, 600);
  }, []);

  const fireDoubleTapLike = useCallback(() => {
    if (!post?.id || !user) return;
    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
    playLikeActionSound();
    triggerDoubleTapHeart();
    const mine = post.myReaction;
    reactionMutation.mutate({
      emoji: mine === DOUBLE_TAP_LIKE_EMOJI ? null : DOUBLE_TAP_LIKE_EMOJI,
    });
  }, [post, user, reactionMutation, triggerDoubleTapHeart]);

  useEffect(() => {
    return () => {
      if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    };
  }, []);

  const postHasVideo = useMemo(() => (post ? postHasUploadedVideo(post) : false), [post]);

  const openReelsForCurrentPost = useCallback(() => {
    if (!post?.id) return;
    const vid = user?.id != null ? String(user.id) : "";
    const aid = post.authorId != null ? String(post.authorId) : "";
    const own = vid.length > 0 && aid === vid;
    setLocation(
      buildReelsPostPath({
        postId: post.id,
        linkCode: post.linkCode,
        isMe: own,
        publicId: post.author.publicId,
        userId: post.authorId,
      }),
    );
  }, [post, user?.id, setLocation]);

  const goBackToProfile = () => setLocation(profilePathFromRoute);

  if (isLoading || !postId) {
    return <PostDetailSkeleton onBack={goBackToProfile} />;
  }

  if (isError) {
    const msg =
      error instanceof Error && error.message.trim() ? error.message : "Проверьте интернет и попробуйте снова";
    return (
      <div className="flex flex-col h-full min-h-0 bg-background">
        <div className="uix-content-x py-3 flex items-center border-b border-border/50">
          <button
            type="button"
            onClick={goBackToProfile}
            className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад к профилю"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <ErrorWithRetry title="Не удалось загрузить пост" description={msg} onRetry={() => void refetch()} />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col h-full min-h-0 bg-background">
        <div className="uix-content-x py-3 flex items-center border-b border-border/50">
          <button
            type="button"
            onClick={goBackToProfile}
            className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад к профилю"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <ListEmptyState
            icon={FileX}
            title="Пост не найден"
            description="Возможно, он был удалён или ссылка устарела."
            actionLabel="К профилю"
            onAction={goBackToProfile}
            secondaryActionLabel="Обновить"
            onSecondaryAction={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  const authorName = [post.author.displayName, post.author.surname].filter(Boolean).join(" ") || `ID ${post.author.publicId}`;
  const viewerId = user?.id != null ? String(user.id) : "";
  const postAuthorId = post.authorId != null ? String(post.authorId) : "";
  const isOwnPost = viewerId.length > 0 && postAuthorId === viewerId;
  const postBody = post.text ?? "";
  const linkEmbedOn = post.linkEmbedEnabled !== false;
  const hasCaption =
    postBody.trim().length > 0 &&
    !(linkEmbedOn && isExternalVideoOnlyCaption(postBody, primaryExternalVideoUrl));
  const reactionTotal = post.reactions?.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const topThreeReactionEmojis = [...(post.reactions ?? [])]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((r) => r.emoji);
  const sharesCount = post.sharesCount ?? 0;
  const lastCommentPreview = pickNewestCommentPreview(post.latestComments);

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
            {user && !isOwnPost ? (
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
            {isOwnPost ? (
              <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                      aria-label="Меню поста"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem
                      className="min-h-[var(--uix-touch-min)]"
                      onClick={() => setLocation(`/create-post?edit=${encodeURIComponent(post.id)}`)}
                    >
                      <PenSquare className="h-4 w-4" />
                      Редактировать
                    </DropdownMenuItem>
                    {post.edgeId ? (
                      <EdgePostAudienceSubmenu
                        current={post.edgeDisplayAudience}
                        disabled={edgeAudienceMutation.isPending}
                        onPick={(edgeDisplayAudience) => {
                          void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                            triggerLightHaptic(),
                          );
                          edgeAudienceMutation.mutate({ postId: post.id, edgeDisplayAudience });
                        }}
                      />
                    ) : null}
                    <DropdownMenuItem
                      className="min-h-[var(--uix-touch-min)] text-destructive focus:text-destructive"
                      onClick={() => {
                        if (window.confirm("Удалить пост?")) {
                          deletePostMutation.mutate(post.id);
                        }
                      }}
                      disabled={deletePostMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить пост
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : !user ? (
              <span className="min-w-[var(--uix-touch-min)]" aria-hidden />
            ) : (
              <div className="relative flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
                      aria-label="Меню поста"
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DropdownMenuItem
                      className="min-h-[var(--uix-touch-min)]"
                      onSelect={() => {
                        requestAnimationFrame(() => setPostReportOpen(true));
                      }}
                    >
                      <Flag className="h-4 w-4" />
                      Пожаловаться
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
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
                  isMe: isOwnPost,
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
              pointerEventsNone
            />
            <div className="min-w-0">
              <h2 className="font-semibold text-[15px] leading-tight group-hover:text-primary transition-colors">
                {authorName}
              </h2>
              <p className="mt-[var(--uix-space-1)] uix-text-caption text-muted-foreground">{formatPostTime(post.createdAt)}</p>
            </div>
          </button>
        </div>

        <div
          className={cn(
            "flex flex-col min-w-0 mb-[var(--uix-space-4)]",
            (hasCaption || primaryExternalVideoUrl || post.edgeId || post.mediaUrls?.length || post.imageUrl) &&
              "gap-[var(--uix-space-3)]",
          )}
        >
          {post.edgeId ? (
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
                    buildProfilePostPath({
                      postId: post.id,
                      linkCode: post.linkCode,
                      isMe: userId === "me",
                      publicId: post.author.publicId,
                      userId: post.authorId,
                      fallbackPath: "/posts",
                    }),
                  ),
                );
              }}
            />
          ) : null}
          <div className="relative w-full">
            <PostMedia
              mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
              layout={post.mediaLayout ?? null}
              className="!mt-0"
              feedEagerImages
              feedVideoAutoplay
              feedReelsInteraction={
                user
                  ? {
                      onDoubleTapFire: fireDoubleTapLike,
                    }
                  : null
              }
              feedReelsDeferredOpen={user && postHasVideo ? openReelsForCurrentPost : undefined}
            />
            <AnimatePresence>
              {doubleTapHeartVisible ? (
                <motion.div
                  key="post-detail-double-tap-heart"
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
          {primaryExternalVideoUrl ? (
            <PostExternalVideoEmbed url={primaryExternalVideoUrl} className="rounded-xl" autoplayInViewport />
          ) : null}
          {hasCaption ? (
            user ? (
              <FeedDoubleTapImageLayer className="min-w-0" onDoubleTap={fireDoubleTapLike} pulseOnDoubleTap={false}>
                <p className="text-[15px] leading-snug tracking-[-0.01em] text-foreground whitespace-pre-wrap">
                  <PostCaptionInlineParts
                    text={postBody}
                    maskExternalEmbed={maskExternalEmbed}
                    onHashtagClick={() => {}}
                    linkClassName="text-primary underline decoration-primary/55 underline-offset-[3px] break-all"
                    hashtagClassName="text-primary font-medium hover:underline underline-offset-2"
                  />
                </p>
              </FeedDoubleTapImageLayer>
            ) : (
              <p className="text-[15px] leading-snug tracking-[-0.01em] text-foreground whitespace-pre-wrap">
                <PostCaptionInlineParts
                  text={postBody}
                  maskExternalEmbed={maskExternalEmbed}
                  onHashtagClick={() => {}}
                  linkClassName="text-primary underline decoration-primary/55 underline-offset-[3px] break-all"
                  hashtagClassName="text-primary font-medium hover:underline underline-offset-2"
                />
              </p>
            )
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

          {lastCommentPreview ? (
            <PostLastCommentTeaser
              comment={lastCommentPreview}
              commentsCount={post.commentsCount}
              onOpen={() => setCommentsOpen(true)}
              ariaLabel={
                post.commentsCount > 1
                  ? `Комментарии: последний от ${lastCommentPreview.user}, есть ещё`
                  : `Комментарии: ${lastCommentPreview.user}`
              }
              className="mt-1"
            />
          ) : null}
        </div>
      </article>

      <ReportContentDialog
        open={postReportOpen}
        onOpenChange={setPostReportOpen}
        target={post ? { targetType: "post", targetId: post.id } : null}
        contextLine="Пост"
      />

      <CommentsModal
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        postId={postId}
        postAuthorId={post?.authorId}
        targetCommentId={deepLinkCommentId}
      />
    </div>
  );
}
