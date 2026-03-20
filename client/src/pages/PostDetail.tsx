import { useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, MessageSquare, Eye, Trash2, FileX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { PostMedia } from "@/components/PostMedia";
import { fetchPost, formatPostTime, recordPostView, deletePost } from "@/lib/posts";
import { useAuth } from "@/contexts/AuthContext";
import CommentsModal from "@/components/CommentsModal";
import { ListEmptyState } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildProfilePath } from "@/lib/profile-route";
import { cn } from "@/lib/utils";

export default function PostDetail({ params }: { params: { id: string; postId: string } }) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const userId = params.id;
  const postId = params.postId;
  const [commentsOpen, setCommentsOpen] = useState(false);
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

  useEffect(() => {
    if (post?.id && user?.id) {
      recordPostView(post.id).catch(() => {});
    }
  }, [post?.id, user?.id]);

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
          <div className="flex justify-end min-w-0">
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
            ) : (
              <span className="min-w-[var(--uix-touch-min)]" aria-hidden />
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
        </div>

        <div className="flex flex-wrap items-center gap-x-[var(--uix-space-5)] gap-y-[var(--uix-space-2)] border-t border-border/30 pt-[var(--uix-space-4)]">
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            className="inline-flex items-center gap-[var(--uix-space-2)] min-h-[var(--uix-touch-min)] rounded-full px-[var(--uix-space-2)] -ml-[var(--uix-space-2)] text-[14px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <MessageSquare className="h-[18px] w-[18px] shrink-0 opacity-80" />
            <span className="tabular-nums">{post.commentsCount}</span>
          </button>
          {(post.viewsCount ?? 0) > 0 && (
            <span className="inline-flex items-center gap-[var(--uix-space-2)] text-[14px] text-muted-foreground tabular-nums">
              <Eye className="h-[18px] w-[18px] shrink-0 opacity-80" />
              {post.viewsCount}
            </span>
          )}
        </div>
      </article>

      <CommentsModal isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} postId={postId} />
    </div>
  );
}
