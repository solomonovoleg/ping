import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, MoreHorizontal, Bell, Link as LinkIcon, Grid, Bookmark, MessageSquare, Share2, Copy, Check, Settings, PenSquare, Trash2, Edit3, BarChart2, Plus, UserX } from "lucide-react";
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
import { fetchStoriesByUser, createStory } from "@/lib/stories";
import { uploadChatMedia } from "@/lib/chat";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { resolveUrl } from "@/lib/api-base";

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
  const [pageStories, setPageStories] = useState<{ id: string; authorId: string; mediaUrl: string; thumbnailUrl: string | null; createdAt: string }[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const storyFileInputRef = useRef<HTMLInputElement>(null);

  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMe = id === "me";
  const authorId = isMe ? user?.id : apiProfile?.id;
  const authorIdReady = isMe ? (authLoading === false) : !!apiProfile;

  useEffect(() => {
    if (!id.trim()) setLocation("/posts");
  }, [id, setLocation]);

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

  const { data: queryStories = [] } = useQuery({
    queryKey: ["stories", authorId],
    queryFn: () => fetchStoriesByUser(authorId!),
    enabled: !!authorId && isMe,
  });

  const profilePosts = isMe ? queryPosts : pagePosts;
  const apiStories = isMe ? queryStories : pageStories;

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
            ? data.stories.filter((s): s is { id: string; authorId: string; mediaUrl: string; thumbnailUrl: string | null; createdAt: string } =>
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
  if (!id.trim()) return null;

  const handleCopyLink = () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const segment = apiProfile?.publicId != null ? String(apiProfile.publicId) : id;
    const url = `${base}/id/${segment}`;
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
  const avatarUrl = isMe ? user?.avatarUrl : apiProfile?.avatarUrl;
  const coverUrl = isMe ? (user as { coverUrl?: string | null })?.coverUrl : apiProfile?.coverUrl;
  const coverResolved = coverUrl?.trim() ? resolveUrl(coverUrl.trim()) : "";
  const coverFallback = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop";
  const cover = coverResolved || coverFallback;
  const storiesForStrip = (apiStories ?? []).filter((s) => s && (s as { id?: string }).id != null).map((s) => {
    const thumb = (s as { thumbnailUrl?: string | null; mediaUrl?: string }).thumbnailUrl || (s as { mediaUrl?: string }).mediaUrl || "";
    return {
      id: (s as { id: string }).id,
      thumb: thumb ? resolveUrl(thumb) : "",
      title: formatPostTime((s as { createdAt?: string }).createdAt ?? ""),
    };
  });

  return (
    <div className="relative flex flex-col min-h-full min-w-0 w-full max-w-full overflow-x-hidden bg-background pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
      {/* Обложка: отдельный контейнер на всю ширину, без отступов (полностью в край). main в AppLayout с overflow-x-visible, чтобы не обрезать. */}
      <div
        className="relative h-48 sm:h-56 flex-shrink-0 overflow-hidden rounded-none bg-gradient-to-br from-muted via-muted/80 to-muted"
        style={{
          width: "calc(100% + max(12px, env(safe-area-inset-left, 0px)) + max(12px, env(safe-area-inset-right, 0px)))",
          marginLeft: "calc(-1 * max(12px, env(safe-area-inset-left, 0px)))",
        }}
      >
        {coverLoadError ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-muted text-muted-foreground text-sm px-4">
            <span>Обложка не загрузилась</span>
            {isMe && (
              <button
                type="button"
                onClick={() => setLocation("/profile/edit")}
                className="text-primary font-medium text-[13px]"
              >
                Добавить в редактировании профиля
              </button>
            )}
          </div>
        ) : (
          <img
            src={cover}
            alt=""
            className="w-full h-full object-cover min-w-0 block"
            decoding="async"
            onError={() => setCoverLoadError(true)}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
      </div>
      <div className="flex flex-col min-h-0 overflow-visible">

      {/* Кнопки поверх шапки — с отступами под safe area */}
      <div className="absolute top-0 left-0 right-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-3 flex items-center justify-between pt-[max(0.75rem,env(safe-area-inset-top,0px))] z-50 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => setLocation("/posts")}
            className="p-2 -ml-1 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors flex items-center min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] justify-center"
            aria-label="Назад в ленту"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label={copied ? "Ссылка скопирована" : "Скопировать ссылку на профиль"}
          >
            {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
          </button>
          {isMe ? (
            <button
              type="button"
              onClick={() => setLocation("/settings")}
              className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
              aria-label="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                aria-label="Уведомления"
              >
                <Bell className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                aria-label="Ещё"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="relative w-full max-w-[480px] min-w-0 mx-auto flex flex-col shrink-0 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] -mt-12 pt-0 overflow-visible">
      {/* Profile Info — overflow-visible чтобы аватар не обрезался */}
      <div className="relative mb-6 overflow-visible">
        <div className="flex justify-between items-end gap-3 mb-3 min-w-0">
          <div 
            className={cn("relative group flex-shrink-0", isMe && "cursor-pointer")}
            onClick={isMe ? () => setLocation("/profile/edit") : () => setActiveStoryIndex(0)}
          >
            <div className="w-28 h-28 rounded-full p-[3px] bg-gradient-to-tr from-primary to-purple-500 transition-transform duration-200 group-active:scale-95 overflow-hidden flex items-center justify-center border-4 border-background shadow-lg">
              <UserAvatar
                avatarUrl={avatarUrl ?? undefined}
                displayName={displayName}
                seed={authorId ?? ""}
                size={112}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            {isMe && (
              <div className="absolute bottom-1 right-1 bg-primary text-white p-1.5 rounded-full border-2 border-background pointer-events-none">
                <Plus className="w-3 h-3" />
              </div>
            )}
          </div>
          
          <div className="flex gap-2 min-w-0 flex-shrink flex-wrap justify-end">
            {isMe ? (
              <>
                <TapScaleButton type="button" haptic subtle className="px-3 py-2 rounded-full font-semibold text-[13px] bg-secondary text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0" aria-label="Статистика">
                  <BarChart2 className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Статистика</span>
                </TapScaleButton>
                <TapScaleButton type="button" onClick={() => setLocation("/profile/edit")} haptic className="px-3 py-2 rounded-full font-semibold text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0" aria-label="Редактировать профиль">
                  <Edit3 className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Изменить</span>
                </TapScaleButton>
              </>
            ) : (
              <div className="flex gap-2 flex-wrap min-w-0 justify-end">
                <TapScaleButton
                  type="button"
                  onClick={handleStartChat}
                  disabled={!apiProfile?.canMessage}
                  haptic
                  title={!apiProfile?.canMessage ? "Подпишитесь, чтобы написать" : "Написать"}
                  className={cn(
                    "px-4 py-2 rounded-full font-semibold text-[14px] transition-all duration-300 flex items-center gap-2",
                    apiProfile?.canMessage
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-muted-foreground cursor-not-allowed"
                  )}
                  aria-label="Написать сообщение"
                >
                  <MessageSquare className="w-4 h-4" />
                  Написать
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  haptic
                  className={cn(
                    "px-4 py-2 rounded-full font-semibold text-[14px] transition-all flex items-center gap-2 disabled:opacity-70",
                    apiProfile?.isFollowing
                      ? "bg-secondary text-foreground hover:bg-secondary/80"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  aria-label={apiProfile?.isFollowing ? "Отписаться" : "Подписаться"}
                >
                  {followLoading ? "…" : apiProfile?.isFollowing ? "Отписаться" : "Подписаться"}
                </TapScaleButton>
              </div>
            )}
          </div>
        </div>

        <h1 className="uix-text-title leading-tight">{displayName}</h1>
        <p className="text-muted-foreground text-[15px] mb-1">
          ID {(isMe ? user?.publicId : apiProfile?.publicId) ?? "—"}
        </p>
        {(isMe ? user?.gender : apiProfile?.gender) && (
          <p className="text-muted-foreground text-[14px] mb-3">
            {(isMe ? user?.gender : apiProfile?.gender) === "male"
              ? "Мужской"
              : (isMe ? user?.gender : apiProfile?.gender) === "female"
                ? "Женский"
                : "Другое"}
          </p>
        )}
        {(isMe ? (user as { bio?: string | null })?.bio : apiProfile?.bio) ? (
          <p className="text-[15px] leading-relaxed mb-2 text-foreground/90 whitespace-pre-wrap">
            {isMe ? (user as { bio?: string | null }).bio : apiProfile?.bio}
          </p>
        ) : null}
        {(() => {
          const link = isMe ? (user as { profileLink?: string | null })?.profileLink : (apiProfile as { profileLink?: string | null })?.profileLink;
          const url = link?.trim();
          if (!url) return null;
          const href = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[15px] text-primary hover:underline break-all mb-2 block">
              {url}
            </a>
          );
        })()}
        <div className="flex items-center gap-4 sm:gap-6 mb-4 flex-wrap">
          <div className="flex flex-col min-w-[4rem]">
            <span className="font-bold text-lg">{isMe ? (myProfileStats?.postsCount ?? profilePosts.length) : (apiProfile?.postsCount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">Постов</span>
          </div>
          <div className="flex flex-col min-w-[4rem]">
            <span className="font-bold text-lg">{isMe ? (myProfileStats?.followersCount ?? 0) : (apiProfile?.followersCount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">Подписчиков</span>
          </div>
          <div className="flex flex-col min-w-[4rem]">
            <span className="font-bold text-lg">{isMe ? (myProfileStats?.followingCount ?? 0) : (apiProfile?.followingCount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">Подписок</span>
          </div>
          <div className="flex flex-col min-w-[4rem]">
            <span className="font-bold text-lg">{isMe ? (myProfileStats?.reactionsCount ?? 0) : (apiProfile?.reactionsCount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">Реакций</span>
          </div>
          <div className="flex flex-col min-w-[4rem]">
            <span className="font-bold text-lg">{isMe ? (myProfileStats?.commentsCount ?? 0) : (apiProfile?.commentsCount ?? 0)}</span>
            <span className="text-xs text-muted-foreground">Комментариев</span>
          </div>
        </div>
      </div>

      {/* Profile Highlights/Stories */}
      <div className="mb-6">
        <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
          {isMe && (
            <>
              <input
                ref={storyFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file || !user?.id) return;
                  setAddingStory(true);
                  try {
                    const url = await uploadChatMedia(file);
                    await createStory(url);
                    queryClient.invalidateQueries({ queryKey: ["stories", user.id] });
                    toast({ title: "Сториз добавлен" });
                  } catch (err) {
                    toast({ title: err instanceof Error ? err.message : "Ошибка", variant: "destructive" });
                  } finally {
                    setAddingStory(false);
                  }
                }}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => storyFileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && storyFileInputRef.current?.click()}
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
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-xl z-40">
        <button 
          onClick={() => setActiveTab("posts")}
          className={cn(
            "flex-1 py-3 text-[15px] font-semibold flex justify-center items-center gap-2 transition-colors relative",
            activeTab === "posts" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Grid className="w-4 h-4" />
          Публикации
          {activeTab === "posts" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
          )}
        </button>
        <button 
          onClick={() => setActiveTab("saved")}
          className={cn(
            "flex-1 py-3 text-[15px] font-semibold flex justify-center items-center gap-2 transition-colors relative",
            activeTab === "saved" ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"
          )}
        >
          <Bookmark className="w-4 h-4" />
          Сохраненное
          {activeTab === "saved" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"></div>
          )}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex flex-col">
        {activeTab === "posts" && isMe && (
          <div className="p-4 border-b border-border/50 bg-secondary/10 flex items-center gap-3 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={() => setLocation("/create-post")}>
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary flex-shrink-0">
              <PenSquare className="w-5 h-5" />
            </div>
            <div className="text-[15px] text-muted-foreground font-medium">
              Написать новый пост...
            </div>
          </div>
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
            <article key={post.id} className="p-4 border-b border-border/50 hover:bg-secondary/20 transition-colors relative group/article">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={avatarUrl ?? undefined}
                    displayName={displayName}
                    seed={authorId ?? ""}
                    size={40}
                    className="w-10 h-10 rounded-xl flex-shrink-0"
                  />
                  <div>
                    <h3 className="font-semibold text-[15px]">{displayName}</h3>
                    <p className="text-xs text-muted-foreground">{formatPostTime(post.createdAt)}</p>
                  </div>
                </div>
                
                {isMe ? (
                  <div className="flex items-center gap-1 opacity-0 group-hover/article:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/profile/me/post/${post.id}`);
                      }}
                      className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
                      className="p-2 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
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
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
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
                        "flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary transition-colors cursor-pointer border active:scale-95 select-none",
                        (post.myReaction ?? null)
                          ? "bg-primary/10 border-primary/30 text-foreground" 
                          : "text-secondary-foreground hover:bg-secondary/80 border-border/30"
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
                        "flex items-center justify-center w-8 h-8 rounded-full bg-secondary transition-colors border",
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
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium border border-border/30 ml-auto"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {post.commentsCount}
                    </button>
                  </div>

                <div className="flex items-center gap-1">
                  <button type="button" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Сохранить в избранное">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Поделиться">
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
          }))} 
          initialIndex={Math.min(activeStoryIndex, (apiStories ?? []).length - 1)} 
          onClose={() => setActiveStoryIndex(null)} 
        />
      )}

      <CommentsModal 
        isOpen={activeCommentPostId !== null} 
        onClose={() => setActiveCommentPostId(null)} 
        postId={activeCommentPostId} 
      />

      </div>
      </div>
    </div>
  );
}
