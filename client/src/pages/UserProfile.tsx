import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, MoreHorizontal, Bell, Link as LinkIcon, Grid, Bookmark, MessageSquare, Share2, Copy, Check, Settings, PenSquare, Trash2, Edit3, BarChart2, Plus, UserX, Eye } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";
import { fetchUserProfile, fetchProfilePage, followUser, unfollowUser, type PublicProfile } from "@/lib/users";
import { startDm } from "@/lib/search";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPostsByAuthor, formatPostTime, addReaction, removeReaction, deletePost, type FeedPost } from "@/lib/posts";
import { PostMedia } from "@/components/PostMedia";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { fetchStoriesByUser, createStory, fetchStoryViewers, type StoryItem, type StoryViewerUser, type StoryExpiresHours } from "@/lib/stories";
import { sendMessage, uploadChatMedia } from "@/lib/chat";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { resolveUrl } from "@/lib/api-base";
import { PullToRefresh } from "@/components/PullToRefresh";
import { buildProfilePath } from "@/lib/profile-route";

export default function UserProfile({ params: paramsProp }: { params?: { id: string } }) {
  const [, setLocation] = useLocation();
  const paramsFromRoute = useParams<{ id?: string }>();
  const fromPath =
    typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/(?:profile|id)\/([^/?#]+)/)?.[1] ?? "")
      : "";
  const id = (paramsProp?.id ?? paramsFromRoute?.id ?? fromPath) ?? "";
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [apiProfile, setApiProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [pagePosts, setPagePosts] = useState<FeedPost[]>([]);
  const [pageStories, setPageStories] = useState<StoryItem[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const [activeViewersStoryId, setActiveViewersStoryId] = useState<string | null>(null);
  const [pendingStoryFile, setPendingStoryFile] = useState<File | null>(null);
  const [showStoryDurationPicker, setShowStoryDurationPicker] = useState(false);
  const [storyExpiresInHours, setStoryExpiresInHours] = useState<StoryExpiresHours>(24);
  const avatarLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avatarLongPressHandledRef = useRef(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const normalizedRouteId = id.trim().replace(/^@+/, "");
  const hasInvalidRouteId = !normalizedRouteId || ["undefined", "null", "nan"].includes(normalizedRouteId.toLowerCase());
  const isMe = id === "me";
  const authorId = isMe ? user?.id : apiProfile?.id;
  const authorIdReady = isMe ? (authLoading === false) : !!apiProfile;

  useEffect(() => {
    if (hasInvalidRouteId) setLocation("/posts");
  }, [hasInvalidRouteId, setLocation]);

  useEffect(() => {
    setCoverLoadError(false);
  }, [isMe ? (user as { coverUrl?: string | null })?.coverUrl : apiProfile?.coverUrl]);

  const {
    data: queryPosts = [],
    isFetching: postsFetching,
    isError: postsError,
    error: postsErrorDetail,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["posts", "author", authorId],
    queryFn: () => fetchPostsByAuthor(authorId!, 50),
    enabled: !!authorId && isMe,
    refetchOnMount: "always",
    staleTime: 0,
  });

  /** Для «мой профиль» — загружаем свои счётчики (посты, реакции, комментарии) */
  const { data: myProfileStats } = useQuery({
    queryKey: ["profile", "me", user?.id],
    queryFn: () => fetchUserProfile(user!.id),
    enabled: isMe && !!user?.id,
  });

  const { data: queryStories = [], refetch: refetchStories } = useQuery({
    queryKey: ["stories", authorId],
    queryFn: () => fetchStoriesByUser(authorId!),
    enabled: !!authorId && isMe,
  });

  const profilePosts = isMe ? queryPosts : pagePosts;
  const apiStories = isMe ? queryStories : pageStories;
  const hasStories = (apiStories ?? []).length > 0;
  const storyViewersCountById = (apiStories ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.id] = 0;
    return acc;
  }, {});

  const { data: activeStoryViewers = [], isLoading: activeStoryViewersLoading } = useQuery({
    queryKey: ["stories", "viewers", activeViewersStoryId],
    queryFn: () => fetchStoryViewers(activeViewersStoryId!),
    enabled: !!activeViewersStoryId && isMe,
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string | null }) => {
      if (emoji) await addReaction(postId, emoji);
      else await removeReaction(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Пост удалён" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка удаления", variant: "destructive" }),
  });

  const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];

  // Чужой профиль: один запрос профиль+посты+сториз (цель ≤0.28 с), отрисовка через flushSync
  useEffect(() => {
    if (isMe || !id.trim()) return;
    setProfileLoading(true);
    setProfileError(false);
    setPagePosts([]);
    setPageStories([]);
    fetchProfilePage(id, 50)
      .then((data) => {
        try {
          if (!data?.profile) {
            setProfileError(true);
            return;
          }
          const posts = Array.isArray(data.posts) ? data.posts.filter((p): p is FeedPost => p != null && typeof (p as FeedPost).id === "string") : [];
          const stories = Array.isArray(data.stories)
            ? data.stories.filter((s): s is StoryItem =>
                s != null && typeof (s as { id?: string }).id === "string")
            : [];
          flushSync(() => {
            setApiProfile(data.profile);
            setPagePosts(posts);
            setPageStories(stories);
          });
        } catch {
          setProfileError(true);
        }
      })
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
  }, [isMe, id]);

  // Ранний выход только после всех хуков, иначе React #310 (разное кол-во хуков между рендерами)
  if (hasInvalidRouteId) return null;

  const handleCopyLink = () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const segment = apiProfile?.publicId != null ? String(apiProfile.publicId) : id;
    const url = `${base}/profile/${segment}`;
    if (!navigator.clipboard?.writeText) {
      toast({ title: "Копирование недоступно", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      toast({ title: "Не удалось скопировать ссылку", variant: "destructive" });
    });
  };

  const handleFollowToggle = async () => {
    if (!apiProfile || followLoading) return;
    setFollowLoading(true);
    try {
      if (apiProfile.isFollowing) {
        await unfollowUser(apiProfile.id);
        toast({ title: "Вы отписались" });
      } else {
        await followUser(apiProfile.id);
        toast({ title: "Вы подписались" });
      }
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const next = await fetchUserProfile(id);
      if (next) setApiProfile(next);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!apiProfile?.canMessage) return;
    try {
      const chat = await startDm(apiProfile.id);
      setLocation(`/chat/${chat.otherMember?.publicId ?? chat.id}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не удалось начать диалог", variant: "destructive" });
    }
  };

  const handleStoryReply = async (payload: { storyId: string; authorId: string; text: string }) => {
    if (!user?.id) {
      toast({ title: "Войдите, чтобы ответить на сториз", variant: "destructive" });
      return;
    }
    if (!payload.authorId || payload.authorId === user.id) {
      toast({ title: "Нельзя отправить ответ на свой сториз", variant: "destructive" });
      return;
    }
    const chat = await startDm(payload.authorId);
    await sendMessage(chat.id, { type: "text", content: payload.text.trim() });
    toast({ title: "Ответ на сториз отправлен" });
  };

  const handleStoryFileSelect = useCallback((file: File | null) => {
    if (!file || !user?.id) return;
    setPendingStoryFile(file);
    setStoryExpiresInHours(24);
    setShowStoryDurationPicker(true);
  }, [user?.id]);

  const handlePublishStory = useCallback(async () => {
    const file = pendingStoryFile;
    if (!file || !user?.id) return;
    setShowStoryDurationPicker(false);
    setAddingStory(true);
    try {
      const url = await uploadChatMedia(file);
      await createStory(url, { expiresInHours: storyExpiresInHours });
      queryClient.invalidateQueries({ queryKey: ["stories", user.id] });
      queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      toast({ title: `Сториз добавлен на ${storyExpiresInHours}ч` });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
    } finally {
      setPendingStoryFile(null);
      setAddingStory(false);
    }
  }, [pendingStoryFile, queryClient, storyExpiresInHours, toast, user?.id]);

  const clearAvatarLongPress = useCallback(() => {
    if (avatarLongPressTimerRef.current) {
      clearTimeout(avatarLongPressTimerRef.current);
      avatarLongPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAvatarLongPress(), [clearAvatarLongPress]);

  const handlePullRefresh = useCallback(async () => {
    if (isMe) {
      await Promise.all([
        refetchPosts(),
        refetchStories(),
        user?.id ? queryClient.invalidateQueries({ queryKey: ["profile", "me", user.id] }) : Promise.resolve(),
      ]);
      return;
    }
    if (!id.trim()) return;
    try {
      const data = await fetchProfilePage(id, 50);
      if (!data?.profile) {
        setProfileError(true);
        return;
      }
      const posts = Array.isArray(data.posts)
        ? data.posts.filter((p): p is FeedPost => p != null && typeof (p as FeedPost).id === "string")
        : [];
      const stories = Array.isArray(data.stories)
        ? data.stories.filter(
            (s): s is StoryItem => s != null && typeof (s as { id?: string }).id === "string"
          )
        : [];
      setProfileError(false);
      setApiProfile(data.profile);
      setPagePosts(posts);
      setPageStories(stories);
    } catch {
      setProfileError(true);
    }
  }, [id, isMe, queryClient, refetchPosts, refetchStories, user?.id]);

  if (!isMe && profileLoading) {
    return (
      <div className="flex flex-col h-full min-h-[200px] w-full max-w-full overflow-x-hidden bg-background">
        <div className="uix-content-x py-3 flex items-center border-b border-border/50">
          <button
            type="button"
            onClick={() => setLocation("/posts")}
            className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад в ленту"
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
  if (!isMe && (profileError || !apiProfile)) {
    return (
      <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-x-hidden bg-background">
        <div className="uix-content-x py-3 flex items-center border-b border-border/50">
          <button
            type="button"
            onClick={() => setLocation("/posts")}
            className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад в ленту"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <ListEmptyState
            icon={UserX}
            title="Пользователь не найден"
            description="Возможно, он удалил аккаунт или изменил настройки доступа."
            actionLabel="В ленту"
            onAction={() => setLocation("/posts")}
          />
        </div>
      </div>
    );
  }

  const displayName =
    isMe && user
      ? [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль"
      : apiProfile
        ? [apiProfile.displayName, apiProfile.surname].filter(Boolean).join(" ") || `ID ${apiProfile.publicId}`
        : "";
  const usernameHandle = `@${String((isMe ? user?.publicId : apiProfile?.publicId) ?? id)}`;
  const avatarUrl = isMe ? user?.avatarUrl : apiProfile?.avatarUrl;
  const profileCoverUrl = isMe ? (user as { coverUrl?: string | null })?.coverUrl : apiProfile?.coverUrl;
  const isCoverEnabled = isMe
    ? (user as { showCover?: boolean })?.showCover !== false
    : (apiProfile as { showCover?: boolean })?.showCover !== false;
  const resolvedCoverUrl = profileCoverUrl ? resolveUrl(profileCoverUrl) : "";
  const hasCoverAsset = !!resolvedCoverUrl && !coverLoadError;
  const hasCover = isCoverEnabled && hasCoverAsset;
  const storiesForStrip = (apiStories ?? []).filter((s) => s && (s as { id?: string }).id != null).map((s) => {
    const thumb = (s as { thumbnailUrl?: string | null; mediaUrl?: string }).thumbnailUrl || (s as { mediaUrl?: string }).mediaUrl || "";
    return {
      id: (s as { id: string }).id,
      thumb: thumb ? resolveUrl(thumb) : "",
      title: formatPostTime((s as { createdAt?: string }).createdAt ?? ""),
    };
  });

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full max-w-full overflow-x-hidden bg-background overscroll-y-none">
      <PullToRefresh
        onRefresh={handlePullRefresh}
        className="min-h-0 flex-1"
        disabled={showStoryDurationPicker || !!activeViewersStoryId || activeStoryIndex !== null}
      >
      <div className="flex flex-col min-h-0 overflow-visible pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
      <div className="uix-content-x sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/90 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={() => setLocation("/posts")}
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-foreground hover:bg-secondary/70"
          aria-label="Назад в ленту"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="truncate px-2 text-[16px] font-semibold">{usernameHandle}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-foreground hover:bg-secondary/70"
            aria-label={copied ? "Ссылка скопирована" : "Скопировать ссылку на профиль"}
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
          {isMe ? (
            <button
              type="button"
              onClick={() => setLocation("/settings")}
              className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-foreground hover:bg-secondary/70"
              aria-label="Настройки"
            >
              <Settings className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-foreground hover:bg-secondary/70"
              aria-label="Ещё"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {hasCover ? (
        <div className="relative h-36 w-full overflow-hidden border-b border-border/60 bg-muted/30">
          <img
            src={resolvedCoverUrl}
            alt="Обложка профиля"
            className="h-full w-full object-cover"
            onError={() => setCoverLoadError(true)}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
          {isMe && (
            <button
              type="button"
              onClick={() => setLocation("/profile/edit")}
              className="absolute bottom-3 right-3 min-h-[var(--uix-touch-min)] rounded-full border border-white/25 bg-black/50 px-3 text-xs font-medium text-white backdrop-blur hover:bg-black/60"
              aria-label="Изменить обложку"
            >
              Изменить обложку
            </button>
          )}
        </div>
      ) : isMe ? (
        <div className="uix-content-x mt-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/profile/edit")}
            haptic
            subtle
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border bg-secondary/20 px-4 py-3 text-left hover:bg-secondary/35"
            aria-label={hasCoverAsset ? "Включить обложку профиля" : "Добавить обложку в профиль"}
          >
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {hasCoverAsset ? "Обложка скрыта" : "Добавьте обложку профиля"}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {hasCoverAsset
                  ? "Включите показ обложки в настройках профиля"
                  : "С ней страница будет выглядеть живее и персональнее"}
              </p>
            </div>
            <Plus className="h-5 w-5 text-muted-foreground" />
          </TapScaleButton>
        </div>
      ) : null}

      <div className={cn("uix-content-x pt-3", hasCover && "-mt-8 relative z-10")}>
        <div className={cn("mb-3 flex items-center gap-4", hasCover && "rounded-2xl border border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur")}>
          <div
            className={cn("relative group flex-shrink-0", isMe && "cursor-pointer")}
            onClick={() => {
              if (!isMe) {
                setActiveStoryIndex(0);
                return;
              }
              if (avatarLongPressHandledRef.current) {
                avatarLongPressHandledRef.current = false;
                return;
              }
              if (hasStories) {
                setActiveStoryIndex(0);
              } else {
                storyFileInputRef.current?.click();
              }
            }}
            onPointerDown={() => {
              if (!isMe) return;
              avatarLongPressHandledRef.current = false;
              clearAvatarLongPress();
              avatarLongPressTimerRef.current = setTimeout(() => {
                avatarLongPressHandledRef.current = true;
                storyFileInputRef.current?.click();
              }, 420);
            }}
            onPointerUp={clearAvatarLongPress}
            onPointerLeave={clearAvatarLongPress}
            onPointerCancel={clearAvatarLongPress}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div
              className={cn(
                "h-24 w-24 rounded-full p-[3px] transition-transform duration-200 group-active:scale-95",
                hasStories ? "bg-gradient-to-tr from-primary via-violet-500 to-fuchsia-500 animate-story-ring" : "bg-border"
              )}
            >
              <UserAvatar
                avatarUrl={avatarUrl ?? undefined}
                displayName={displayName}
                seed={authorId ?? ""}
                size={96}
                className="h-full w-full rounded-full border-2 border-background object-cover"
              />
            </div>
            {isMe && (
              <div className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-primary p-1 text-white pointer-events-none">
                <Plus className="h-3 w-3" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-around gap-1 text-center">
            <div className="min-w-[58px]">
              <p className="text-[18px] font-bold leading-tight">{isMe ? (myProfileStats?.postsCount ?? profilePosts.length) : (apiProfile?.postsCount ?? 0)}</p>
              <p className="text-[12px] text-muted-foreground">Посты</p>
            </div>
            <div className="min-w-[58px]">
              <p className="text-[18px] font-bold leading-tight">{isMe ? (myProfileStats?.followersCount ?? 0) : (apiProfile?.followersCount ?? 0)}</p>
              <p className="text-[12px] text-muted-foreground">Подписчики</p>
            </div>
            <div className="min-w-[58px]">
              <p className="text-[18px] font-bold leading-tight">{isMe ? (myProfileStats?.followingCount ?? 0) : (apiProfile?.followingCount ?? 0)}</p>
              <p className="text-[12px] text-muted-foreground">Подписки</p>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <p className="text-[15px] font-semibold leading-tight">{displayName}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            ID {(isMe ? user?.publicId : apiProfile?.publicId) ?? "—"}
          </p>
          {(isMe ? (user as { bio?: string | null })?.bio : apiProfile?.bio) ? (
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/90">
              {isMe ? (user as { bio?: string | null }).bio : apiProfile?.bio}
            </p>
          ) : null}
          {(() => {
            const link = isMe ? (user as { profileLink?: string | null })?.profileLink : (apiProfile as { profileLink?: string | null })?.profileLink;
            const url = link?.trim();
            if (!url) return null;
            const href = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1.5 block break-all text-[14px] text-primary hover:underline">
                {url}
              </a>
            );
          })()}
        </div>

        {isMe ? (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <TapScaleButton
              type="button"
              onClick={() => setLocation("/profile/edit")}
              haptic
              className="min-h-[var(--uix-touch-min)] rounded-xl border border-border bg-secondary/70 px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-secondary"
              aria-label="Редактировать профиль"
            >
              Изменить профиль
            </TapScaleButton>
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="min-h-[var(--uix-touch-min)] rounded-xl border border-border bg-secondary/70 px-3 py-2 text-[13px] font-semibold text-foreground hover:bg-secondary"
              aria-label="Статистика"
            >
              Статистика
            </TapScaleButton>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <TapScaleButton
              type="button"
              onClick={handleFollowToggle}
              disabled={followLoading}
              haptic
              className={cn(
                "min-h-[var(--uix-touch-min)] rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors disabled:opacity-70",
                apiProfile?.isFollowing
                  ? "border border-border bg-secondary/80 text-foreground hover:bg-secondary"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              aria-label={apiProfile?.isFollowing ? "Отписаться" : "Подписаться"}
            >
              {followLoading ? "..." : apiProfile?.isFollowing ? "Подписки" : "Подписаться"}
            </TapScaleButton>
            <TapScaleButton
              type="button"
              onClick={handleStartChat}
              disabled={!apiProfile?.canMessage}
              haptic
              className={cn(
                "min-h-[var(--uix-touch-min)] rounded-xl border border-border px-3 py-2 text-[13px] font-semibold transition-colors",
                apiProfile?.canMessage ? "bg-secondary/70 text-foreground hover:bg-secondary" : "bg-secondary/40 text-muted-foreground"
              )}
              aria-label="Написать сообщение"
            >
              Написать
            </TapScaleButton>
          </div>
        )}
      </div>

      <div className="uix-content-x mb-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-semibold tracking-[0.02em] text-muted-foreground">Актуальное</p>
          {isMe && (
            <button
              type="button"
              onClick={() => storyFileInputRef.current?.click()}
              className="rounded-full px-2 py-1 text-[12px] font-medium text-primary hover:bg-primary/10"
            >
              Добавить
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
          {isMe && (
            <>
              <input
                ref={storyFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  handleStoryFileSelect(file);
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => storyFileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && storyFileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group min-w-[4rem]",
                  addingStory && "opacity-60 pointer-events-none"
                )}
              >
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center group-active:scale-95 transition-transform duration-200 text-muted-foreground group-hover:text-primary group-hover:border-primary/50">
                  {addingStory ? (
                    <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-6 h-6" />
                  )}
                </div>
                <span className="text-[12px] font-medium text-foreground/80">
                  {addingStory ? "Загрузка…" : "Новое"}
                </span>
              </div>
              {storiesForStrip.length === 0 && (
                <div className="flex w-[208px] flex-shrink-0 items-center gap-2 rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-3 py-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-foreground">Добавьте первое актуальное</p>
                    <p className="text-[11px] text-muted-foreground">Сториз закрепится в профиле</p>
                  </div>
                </div>
              )}
            </>
          )}
          {storiesForStrip.map((story, idx) => (
            <div 
              key={story.id} 
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
              onClick={() => setActiveStoryIndex(idx)}
            >
              <div className="w-16 h-16 rounded-full p-[2px] border border-border group-active:scale-95 transition-transform duration-200">
                <img 
                  src={story.thumb} 
                  alt={story.title} 
                  className="w-full h-full rounded-full object-cover border-2 border-background"
                />
              </div>
              <span className="text-[12px] font-medium text-foreground/80">
                {story.title}
              </span>
            </div>
          ))}
          {!isMe && storiesForStrip.length === 0 && (
            <div className="flex w-full min-w-[220px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-4 py-4 text-center">
              <p className="text-[12px] text-muted-foreground">Пока нет актуальных историй</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-40 flex border-b border-border/50 bg-background/90 backdrop-blur-xl">
        <button 
          onClick={() => setActiveTab("posts")}
          className={cn(
            "relative flex flex-1 items-center justify-center py-3 transition-colors",
            activeTab === "posts" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
          aria-label="Публикации"
        >
          <Grid className="h-5 w-5" />
          {activeTab === "posts" && (
            <div className="absolute bottom-0 left-1/2 h-0.5 w-14 -translate-x-1/2 rounded-t-full bg-foreground" />
          )}
        </button>
        <button 
          onClick={() => setActiveTab("saved")}
          className={cn(
            "relative flex flex-1 items-center justify-center py-3 transition-colors",
            activeTab === "saved" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
          aria-label="Сохранённое"
        >
          <Bookmark className="h-5 w-5" />
          {activeTab === "saved" && (
            <div className="absolute bottom-0 left-1/2 h-0.5 w-14 -translate-x-1/2 rounded-t-full bg-foreground" />
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col gap-2 px-2 pb-2">
        {activeTab === "posts" && isMe && (
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/create-post")}
            haptic
            className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-secondary/20 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
            aria-label="Создать новый пост"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-foreground">Поделиться новостью</p>
              <p className="truncate text-[12px] text-muted-foreground">Текст, фото или видео</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-primary">
              <PenSquare className="h-5 w-5" />
            </div>
          </TapScaleButton>
        )}

        {activeTab === "posts" ? (
          !authorId && authorIdReady === false ? (
            <LoadingProgress loading minHeight="160px" className="min-h-[160px]">
              <div className="min-h-[160px]" />
            </LoadingProgress>
          ) : postsError ? (
            <ErrorWithRetry
              title="Не удалось загрузить посты"
              description={postsErrorDetail?.message ?? "Проверьте интернет и попробуйте снова"}
              retryLabel="Повторить"
              onRetry={() => refetchPosts()}
              className="min-h-[200px]"
            />
          ) : profilePosts.length === 0 && !postsFetching ? (
            <ListEmptyState
              icon={PenSquare}
              title="Пока нет постов"
              description={isMe ? "Напишите первый пост — он появится здесь" : "У пользователя пока нет постов"}
              actionLabel={isMe ? "Написать пост" : undefined}
              onAction={isMe ? () => setLocation("/create-post") : undefined}
            />
          ) : postsFetching && profilePosts.length === 0 ? (
            <LoadingProgress loading minHeight="160px" className="min-h-[160px]">
              <div className="min-h-[160px]" />
            </LoadingProgress>
          ) : (
          profilePosts.map((post: FeedPost) => (
            <article key={post.id} className="relative rounded-2xl border border-border/60 bg-card p-3 shadow-sm transition-colors hover:bg-secondary/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={avatarUrl ?? undefined}
                    displayName={displayName}
                    seed={authorId ?? ""}
                    size={40}
                    className="h-10 w-10 flex-shrink-0 rounded-full"
                  />
                  <div>
                    <h3 className="text-[14px] font-semibold">{displayName}</h3>
                    <p className="text-xs text-muted-foreground">{formatPostTime(post.createdAt)}</p>
                  </div>
                </div>
                
                {isMe ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/profile/me/post/${post.id}`);
                      }}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Удалить пост?")) {
                          deletePostMutation.mutate(post.id);
                        }
                      }}
                      className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                      disabled={deletePostMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                    aria-label="Меню поста"
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="mb-3">
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                  {post.text}
                </p>
                <PostMedia
                  mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 relative">
                    {/* Reactions Pill */}
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
                      {post.reactions?.map((reaction: {emoji: string, count: number}, i: number) => {
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
                        {post.reactions?.reduce((sum: number, r: {count: number}) => sum + r.count, 0) ?? 0}
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
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={(e) => {
                              e.stopPropagation();
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
                  <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Сохранить в избранное">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Поделиться">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </article>
          ))
          )
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
            <Bookmark className="w-12 h-12 mb-4 opacity-20" />
            <p>Здесь пока ничего нет</p>
          </div>
        )}
      </div>

      {activeStoryIndex !== null && (apiStories ?? []).length > 0 && (
        <StoryViewer 
          stories={(apiStories ?? []).map((s) => ({
            id: s.id,
            image: resolveUrl((s as { mediaUrl?: string }).mediaUrl ?? ""),
            userName: displayName,
            userAvatar: resolveUrl(avatarUrl ?? "") || resolveUrl((apiStories?.[0] as { thumbnailUrl?: string; mediaUrl?: string })?.thumbnailUrl ?? (apiStories?.[0] as { mediaUrl?: string })?.mediaUrl ?? ""),
            time: formatPostTime((s as { createdAt?: string }).createdAt ?? ""),
            authorId: (s as { authorId?: string }).authorId ?? (authorId ?? undefined),
          }))} 
          initialIndex={Math.min(activeStoryIndex, (apiStories ?? []).length - 1)} 
          onClose={() => setActiveStoryIndex(null)} 
          canSeeViewers={isMe}
          onOpenViewers={(storyId) => setActiveViewersStoryId(storyId)}
          viewersCountByStoryId={storyViewersCountById}
          onReply={isMe ? undefined : handleStoryReply}
          canReply={!isMe}
        />
      )}

      {showStoryDurationPicker && (
        <div
          className="fixed inset-0 z-[220] flex items-end bg-black/45 px-3 pt-3 pb-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px)+12px)] touch-pan-y"
          onClick={() => {
            setShowStoryDurationPicker(false);
            setPendingStoryFile(null);
          }}
        >
          <div
            className="mx-auto w-full max-w-[480px] max-h-[78vh] overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Срок жизни сториз</p>
              <p className="mt-1 text-xs text-muted-foreground">Выберите, сколько хранить сториз после публикации.</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto overscroll-y-contain p-3 touch-pan-y">
              <div className="grid grid-cols-3 gap-2">
                {([24, 46, 56] as const).map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setStoryExpiresInHours(hours)}
                    className={cn(
                      "min-h-[var(--uix-touch-min)] rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                      storyExpiresInHours === hours
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-foreground hover:bg-secondary"
                    )}
                  >
                    {hours} ч
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowStoryDurationPicker(false);
                    setPendingStoryFile(null);
                  }}
                  className="min-h-[var(--uix-touch-min)] rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-foreground"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handlePublishStory}
                  disabled={addingStory || !pendingStoryFile}
                  className="min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {addingStory ? "Публикация..." : "Опубликовать"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeViewersStoryId && (
        <div
          className="fixed inset-0 z-[220] flex items-end bg-black/45 px-3 pt-3 pb-[calc(var(--uix-nav-bottom)+env(safe-area-inset-bottom,0px)+12px)]"
          onClick={() => setActiveViewersStoryId(null)}
        >
          <div
            className="mx-auto w-full max-w-[480px] rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Кто посмотрел сториз</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveViewersStoryId(null)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
                aria-label="Закрыть список просмотров"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-2">
              {activeStoryViewersLoading ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">Загрузка...</div>
              ) : activeStoryViewers.length === 0 ? (
                <ListEmptyState
                  icon={Eye}
                  title="Пока нет просмотров"
                  description="Когда пользователи посмотрят сториз, они появятся здесь."
                  className="border-none"
                />
              ) : (
                (activeStoryViewers as StoryViewerUser[]).map((viewer) => (
                  <button
                    key={viewer.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary/60"
                    onClick={() =>
                      setLocation(
                        buildProfilePath({
                          publicId: viewer.publicId,
                          userId: viewer.id,
                          fallbackPath: "/posts",
                        })
                      )
                    }
                  >
                    <UserAvatar
                      avatarUrl={viewer.avatarUrl ?? undefined}
                      displayName={[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                      seed={viewer.id}
                      size={36}
                      className="h-9 w-9"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatPostTime(viewer.viewedAt)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <CommentsModal 
        isOpen={activeCommentPostId !== null} 
        onClose={() => setActiveCommentPostId(null)} 
        postId={activeCommentPostId} 
      />

      </div>
      </PullToRefresh>
    </div>
  );
}
