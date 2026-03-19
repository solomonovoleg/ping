import { useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, MessageSquare, Eye, Trash2, FileX } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { PostMedia } from "@/components/PostMedia";
import { fetchPost, formatPostTime, recordPostView, deletePost, type FeedPost } from "@/lib/posts";
import { useAuth } from "@/contexts/AuthContext";
import CommentsModal from "@/components/CommentsModal";
import { ListEmptyState } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { buildProfilePath } from "@/lib/profile-route";

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

  return (
    <div className="flex flex-col h-full bg-background pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))] w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="sticky top-0 z-10 uix-content-x py-3 flex items-center justify-between gap-2 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocation(profilePathFromRoute)}
            className="p-2 -ml-2 rounded-full text-primary hover:bg-primary/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад к профилю"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="uix-text-title font-semibold">Пост</span>
        </div>
        {post.authorId === user?.id && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Удалить пост?")) {
                deletePostMutation.mutate(post.id);
              }
            }}
            disabled={deletePostMutation.isPending}
            className="p-2 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Удалить пост"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      <article className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <button
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
            className="flex items-center gap-3 group"
          >
            <UserAvatar
              avatarUrl={post.author.avatarUrl ?? undefined}
              displayName={authorName}
              seed={post.authorId}
              size={40}
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div className="text-left">
              <h3 className="font-semibold text-[15px] group-hover:text-primary transition-colors">{authorName}</h3>
              <p className="text-xs text-muted-foreground">{formatPostTime(post.createdAt)}</p>
            </div>
          </button>
        </div>

        <div className="mb-3">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{post.text}</p>
          <PostMedia
            mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
            layout={post.mediaLayout ?? null}
          />
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <button
            onClick={() => setCommentsOpen(true)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            {post.commentsCount}
          </button>
          {(post.viewsCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {post.viewsCount}
            </span>
          )}
        </div>
      </article>

      <CommentsModal isOpen={commentsOpen} onClose={() => setCommentsOpen(false)} postId={postId} />
    </div>
  );
}
