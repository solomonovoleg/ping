import { useState, useEffect, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, MoreHorizontal, Bookmark, MessageSquare, Share2, Copy, Settings, PenSquare, Trash2, Edit3, BarChart2, Plus, UserX, Eye, Play, Tag } from "lucide-react";
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
import {
  archiveStory,
  deleteStory,
  fetchStoriesByUser,
  createStory,
  fetchStoryViewers,
  likeStory,
  recordStoryView,
  unlikeStory,
  type StoryItem,
  type StoryViewerUser,
  type StoryExpiresHours,
} from "@/lib/stories";
import { sendMessage, uploadChatMedia } from "@/lib/chat";
import { UserAvatar } from "@/components/UserAvatar";
import { resolveUrl } from "@/lib/api-base";
import { PullToRefresh } from "@/components/PullToRefresh";
import { buildProfilePath } from "@/lib/profile-route";
import { playLikeActionSound } from "@/lib/send-sound";
import {
  PulseProfileLayout,
  PulseProfileIconButton,
  PulseProfileAddContentStrip,
  PulseProfileThemedPostCard,
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
  usePulseProfileTheme,
} from "@/features/profile/pulse-profile";

function formatGenderChip(g: string | null | undefined): string | null {
  if (!g) return null;
  const x = g.toLowerCase();
  if (x === "male" || x === "мужской") return "♂ Мужской";
  if (x === "female" || x === "женский") return "♀ Женский";
  if (x === "other" || x === "другое") return "Другое";
  return null;
}

function formatBirthChip(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] as const;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Строка под заголовком поста в макете PULSE: «Видео · 2 дн» без «назад». */
function pulseProfilePostMeta(post: FeedPost): string {
  const url = firstPostMediaUrl(post);
  const video = url ? isVideoMediaUrl(url) : false;
  const photo = url && !video;
  const t = formatPostTime(post.createdAt).replace(/\s*назад\s*$/i, "").trim();
  if (video) return `Видео · ${t}`;
  if (photo) return `Фото · ${t}`;
  return t;
}

function firstPostMediaUrl(post: FeedPost): string {
  const urls = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  const u = urls[0];
  return u ? resolveUrl(u) : "";
}

function isVideoMediaUrl(url: string) {
  return /\.(mp4|webm|mov|m4v|mkv)(\?|$)/i.test(url);
}

function PulseProfileCaption({ children }: { children: string }) {
  const { th } = usePulseProfileTheme();
  return (
    <p
      className="whitespace-pre-wrap text-[15px] leading-snug tracking-[-0.01em]"
      style={{ color: th.text, opacity: 0.9 }}
    >
      {children}
    </p>
  );
}

function ProfileMePulseActions({ onEdit, onShare }: { onEdit: () => void; onShare: () => void }) {
  return (
    <div className="flex gap-2">
      <PulseProfileIconButton variant="primary" icon={Edit3} label="Редактировать" onClick={onEdit} />
      <PulseProfileIconButton variant="surface" icon={BarChart2} label="Статистика" onClick={() => {}} />
      <PulseProfileIconButton variant="surface" icon={Share2} label="Поделиться" onClick={onShare} />
    </div>
  );
}

function ProfileOtherPulseActions({
  isFollowing,
  followLoading,
  onFollow,
  onMessage,
  canMessage,
}: {
  isFollowing: boolean;
  followLoading: boolean;
  onFollow: () => void;
  onMessage: () => void;
  canMessage: boolean;
}) {
  const { th } = usePulseProfileTheme();
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onFollow}
        disabled={followLoading}
        className="flex-1 flex items-center justify-center rounded-2xl min-h-[var(--uix-touch-min)] active:scale-[0.98] transition-transform disabled:opacity-60"
        style={{
          height: 40,
          background: isFollowing ? th.surface : th.accentDim,
          border: `1px solid ${isFollowing ? th.border : th.accentBorder}`,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: isFollowing ? th.text : th.accent }}>
          {followLoading ? "…" : isFollowing ? "Подписки" : "Подписаться"}
        </span>
      </button>
      <button
        type="button"
        onClick={onMessage}
        disabled={!canMessage}
        className="flex-1 flex items-center justify-center rounded-2xl min-h-[var(--uix-touch-min)] active:scale-[0.98] transition-transform disabled:opacity-50"
        style={{ height: 40, background: th.surface, border: `1px solid ${th.border}` }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: th.textSub }}>Написать</span>
      </button>
    </div>
  );
}

export default function UserProfile({ params: paramsProp }: { params?: { id: string } }) {
  const [, setLocation] = useLocation();
  const paramsFromRoute = useParams<{ id?: string }>();
  const fromPath =
    typeof window !== "undefined"
      ? (window.location.pathname.match(/^\/(?:profile|id)\/([^/?#]+)/)?.[1] ?? "")
      : "";
  const id = (paramsProp?.id ?? paramsFromRoute?.id ?? fromPath) ?? "";
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const [postViewMode, setPostViewMode] = useState<"list" | "grid">("list");
  const [pulseAvatarMenuOpen, setPulseAvatarMenuOpen] = useState(false);
  const [profileMoreOpen, setProfileMoreOpen] = useState(false);
  const pulseScrollRef = useRef<HTMLDivElement>(null);
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
  const [likedStoryIds, setLikedStoryIds] = useState<Record<string, boolean>>({});
  const [likesCountByStoryId, setLikesCountByStoryId] = useState<Record<string, number>>({});
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
    acc[s.id] = Number((s as { viewsCount?: number }).viewsCount ?? 0);
    return acc;
  }, {});

  useEffect(() => {
    const nextLiked: Record<string, boolean> = {};
    const nextLikesCount: Record<string, number> = {};
    for (const story of apiStories ?? []) {
      nextLiked[story.id] = story.isLiked === true;
      nextLikesCount[story.id] = Number(story.likesCount ?? 0);
    }
    setLikedStoryIds(nextLiked);
    setLikesCountByStoryId(nextLikesCount);
  }, [apiStories]);

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
    const segment = isMe
      ? String(user?.publicId ?? "me")
      : apiProfile?.publicId != null
        ? String(apiProfile.publicId)
        : normalizedRouteId;
    const url = `${base}/profile/${segment}`;
    if (!navigator.clipboard?.writeText) {
      toast({ title: "Копирование недоступно", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Ссылка скопирована" });
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

  const handleStoryReply = async (payload: {
    storyId: string;
    authorId: string;
    text: string;
    story: { id: string; image: string; userName: string; userAvatar: string; time: string };
  }) => {
    if (!user?.id) {
      toast({ title: "Войдите, чтобы ответить на сториз", variant: "destructive" });
      return;
    }
    if (!payload.authorId || payload.authorId === user.id) {
      toast({ title: "Нельзя отправить ответ на свой сториз", variant: "destructive" });
      return;
    }
    const chat = await startDm(payload.authorId);
    const storyPayload = {
      storyId: payload.story.id,
      mediaUrl: payload.story.image,
      authorId: payload.authorId,
      authorName: payload.story.userName,
      authorAvatar: payload.story.userAvatar,
      storyTimeLabel: payload.story.time,
      replyText: payload.text.trim(),
    };
    await sendMessage(chat.id, { type: "story_reply", content: JSON.stringify(storyPayload) });
    toast({ title: "Ответ на сториз отправлен" });
  };

  const handleStoryLikeToggle = async (storyId: string, liked: boolean) => {
    const prevLiked = likedStoryIds[storyId] ?? false;
    const prevCount = likesCountByStoryId[storyId] ?? 0;
    const optimisticLiked = !liked;
    const optimisticCount = Math.max(0, prevCount + (liked ? -1 : 1));
    setLikedStoryIds((prev) => ({ ...prev, [storyId]: optimisticLiked }));
    setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: optimisticCount }));
    try {
      const result = liked ? await unlikeStory(storyId) : await likeStory(storyId);
      setLikedStoryIds((prev) => ({ ...prev, [storyId]: !!result.isLiked }));
      setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: Number(result.likesCount ?? optimisticCount) }));
      if (!liked && result.isLiked) {
        playLikeActionSound();
      }
    } catch (err) {
      setLikedStoryIds((prev) => ({ ...prev, [storyId]: prevLiked }));
      setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: prevCount }));
      toast({ title: err instanceof Error ? err.message : "Не удалось обновить лайк", variant: "destructive" });
    }
  };

  const handleStoryShare = async (story: { id: string; image: string; userName: string; time: string }) => {
    const shareText = `Сториз ${story.userName}`;
    if (navigator.share) {
      await navigator.share({ title: shareText, text: shareText, url: story.image });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(story.image);
      toast({ title: "Ссылка на сториз скопирована" });
      return;
    }
    throw new Error("Поделиться не удалось");
  };

  const handleStoryArchive = async (storyId: string) => {
    await archiveStory(storyId);
    toast({ title: "Сториз перемещена в архив" });
    setActiveStoryIndex(null);
    await refetchStories();
  };

  const handleStoryDelete = async (storyId: string) => {
    await deleteStory(storyId);
    toast({ title: "Сториз удалена" });
    setActiveStoryIndex(null);
    await refetchStories();
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
  const nicknameForPill = (
    (isMe ? (user as { nickname?: string | null })?.nickname : apiProfile?.nickname) ?? ""
  )
    .trim()
    .replace(/^@+/, "");
  const usernamePillText =
    nicknameForPill.length > 0
      ? nicknameForPill
      : String((isMe ? user?.publicId : apiProfile?.publicId) ?? id);
  const avatarUrl = isMe ? user?.avatarUrl : apiProfile?.avatarUrl;
  const profileCoverUrl = isMe ? (user as { coverUrl?: string | null })?.coverUrl : apiProfile?.coverUrl;
  const isCoverEnabled = isMe
    ? (user as { showCover?: boolean })?.showCover !== false
    : (apiProfile as { showCover?: boolean })?.showCover !== false;
  const resolvedCoverUrl = profileCoverUrl ? resolveUrl(profileCoverUrl) : "";
  const hasCoverAsset = !!resolvedCoverUrl && !coverLoadError;
  const hasCover = isCoverEnabled && hasCoverAsset;

  const publicIdStr = String((isMe ? user?.publicId : apiProfile?.publicId) ?? normalizedRouteId);
  const genderChip = formatGenderChip(isMe ? (user as { gender?: string | null })?.gender : apiProfile?.gender);
  const birthChip = isMe ? formatBirthChip((user as { birthDate?: string | null })?.birthDate) : null;
  const profileLinkRaw = isMe
    ? (user as { profileLink?: string | null })?.profileLink
    : (apiProfile as { profileLink?: string | null })?.profileLink;
  const profileLinkTrim = profileLinkRaw?.trim() ?? "";
  const profileLinkHref =
    profileLinkTrim && (profileLinkTrim.startsWith("http://") || profileLinkTrim.startsWith("https://"))
      ? profileLinkTrim
      : profileLinkTrim
        ? `https://${profileLinkTrim}`
        : null;

  const handleAvatarMainClick = () => {
    setPulseAvatarMenuOpen(false);
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
  };

  const renderPulsePostsContent = () => {
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
          <ListEmptyState
            icon={Bookmark}
            title="Сохранённое"
            description="Здесь появятся сохранённые посты, когда мы подключим раздел к аккаунту."
          />
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
                aria-label="Открыть пост"
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
          title="Не удалось загрузить посты"
          description={postsErrorDetail?.message ?? "Проверьте интернет и попробуйте снова"}
          retryLabel="Повторить"
          onRetry={() => refetchPosts()}
          className="min-h-[200px]"
        />
      );
    }
    if (profilePosts.length === 0 && !postsFetching) {
      return (
        <ListEmptyState
          icon={PenSquare}
          title="Пока нет постов"
          description={isMe ? "Напишите первый пост — он появится здесь" : "У пользователя пока нет постов"}
          actionLabel={isMe ? "Написать пост" : undefined}
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
                      aria-label="Редактировать пост"
                    >
                      <Edit3 className="w-[18px] h-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Удалить пост?")) {
                          deletePostMutation.mutate(post.id);
                        }
                      }}
                      className="rounded-full p-2 text-current opacity-70 transition-colors hover:bg-red-500/15 hover:text-red-500 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                      disabled={deletePostMutation.isPending}
                      aria-label="Удалить пост"
                    >
                      <Trash2 className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="shrink-0 p-2 rounded-full text-current opacity-70 hover:opacity-100 hover:bg-black/10 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                    aria-label="Меню поста"
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
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
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
                  <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Сохранить в избранное">
                    <Bookmark className="w-5 h-5" />
                  </button>
                  <button type="button" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Поделиться">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </PulseProfileThemedPostCard>
          );
        })}
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overscroll-y-none">
      <PullToRefresh
        scrollRef={pulseScrollRef}
        onRefresh={handlePullRefresh}
        className="min-h-0 flex-1"
        disabled={showStoryDurationPicker || !!activeViewersStoryId || activeStoryIndex !== null || profileMoreOpen}
      >
        {isMe ? (
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
        ) : null}
        <PulseProfileLayout
          scrollRef={pulseScrollRef}
          coverUrl={hasCover ? resolvedCoverUrl : null}
          onCoverError={() => setCoverLoadError(true)}
          onBack={() => setLocation("/posts")}
          onMore={() => setProfileMoreOpen(true)}
          usernamePill={usernamePillText}
          displayName={displayName}
          showVerified
          idChip={Number(publicIdStr) === 2 ? "Founder · ID 2" : `ID ${publicIdStr}`}
          genderChip={genderChip}
          birthChip={birthChip}
          bio={isMe ? (user as { bio?: string | null })?.bio ?? null : apiProfile?.bio ?? null}
          linkDisplay={profileLinkTrim || null}
          linkHref={profileLinkHref}
          postsCount={isMe ? (myProfileStats?.postsCount ?? profilePosts.length) : (apiProfile?.postsCount ?? 0)}
          followersCount={isMe ? (myProfileStats?.followersCount ?? 0) : (apiProfile?.followersCount ?? 0)}
          followingCount={isMe ? (myProfileStats?.followingCount ?? 0) : (apiProfile?.followingCount ?? 0)}
          onFollowersClick={() => setLocation(`/profile/${encodeURIComponent(isMe ? "me" : normalizedRouteId)}/followers`)}
          onFollowingClick={() => setLocation(`/profile/${encodeURIComponent(isMe ? "me" : normalizedRouteId)}/following`)}
          actionRow={
            isMe ? (
              <ProfileMePulseActions onEdit={() => setLocation("/profile/edit")} onShare={handleCopyLink} />
            ) : (
              <ProfileOtherPulseActions
                isFollowing={!!apiProfile?.isFollowing}
                followLoading={followLoading}
                onFollow={handleFollowToggle}
                onMessage={handleStartChat}
                canMessage={!!apiProfile?.canMessage}
              />
            )
          }
          onHighlightNew={isMe ? () => !addingStory && storyFileInputRef.current?.click() : undefined}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          postView={postViewMode}
          onTogglePostView={() => setPostViewMode((v) => (v === "list" ? "grid" : "list"))}
          addContentStrip={
            isMe && activeTab === "posts" ? (
              <PulseProfileAddContentStrip onClick={() => setLocation("/create-post")} disabled={false} />
            ) : null
          }
          postsContent={renderPulsePostsContent()}
          avatarInner={
            <UserAvatar
              avatarUrl={avatarUrl ?? undefined}
              displayName={displayName}
              seed={authorId ?? ""}
              size={PULSE_PROFILE_AVATAR_INNER_PX}
              cornerRadius={PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX}
              className="h-full w-full object-cover"
            />
          }
          onAvatarPress={handleAvatarMainClick}
          onAvatarPointerDown={
            isMe
              ? () => {
                  avatarLongPressHandledRef.current = false;
                  clearAvatarLongPress();
                  avatarLongPressTimerRef.current = setTimeout(() => {
                    avatarLongPressHandledRef.current = true;
                    storyFileInputRef.current?.click();
                  }, 420);
                }
              : undefined
          }
          onAvatarPointerUp={isMe ? clearAvatarLongPress : undefined}
          onAvatarPointerLeave={isMe ? clearAvatarLongPress : undefined}
          onAvatarPointerCancel={isMe ? clearAvatarLongPress : undefined}
          onAvatarContextMenu={isMe ? (e) => e.preventDefault() : undefined}
          showAvatarPlus={isMe}
          onAvatarPlusClick={() => setPulseAvatarMenuOpen((o) => !o)}
          avatarMenuOpen={pulseAvatarMenuOpen}
          onAvatarMenuOpenChange={setPulseAvatarMenuOpen}
          avatarMenuItems={
            isMe
              ? [
                  { emoji: "📖", label: "Добавить сторис", onClick: () => storyFileInputRef.current?.click() },
                  { emoji: "✏️", label: "Редактировать профиль", onClick: () => setLocation("/profile/edit") },
                  { emoji: "🖼", label: "Обложка профиля", onClick: () => setLocation("/profile/edit") },
                ]
              : []
          }
          hasStoryGradient={hasStories}
        />
      </PullToRefresh>

      {profileMoreOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-end justify-center bg-black/50 px-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))]"
          role="dialog"
          aria-modal="true"
          aria-label="Действия профиля"
          onClick={() => setProfileMoreOpen(false)}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border border-border bg-background p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
              onClick={() => {
                handleCopyLink();
                setProfileMoreOpen(false);
              }}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Скопировать ссылку
            </button>
            {isMe ? (
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium hover:bg-secondary min-h-[var(--uix-touch-min)]"
                onClick={() => {
                  setProfileMoreOpen(false);
                  setLocation("/settings");
                }}
              >
                <Settings className="h-4 w-4 shrink-0" aria-hidden />
                Настройки
              </button>
            ) : null}
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-center rounded-xl py-3 text-sm text-muted-foreground min-h-[var(--uix-touch-min)]"
              onClick={() => setProfileMoreOpen(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      {activeStoryIndex !== null && (apiStories ?? []).length > 0 && (
        <StoryViewer
          stories={(apiStories ?? []).map((s) => ({
            id: s.id,
            image: resolveUrl((s as { mediaUrl?: string }).mediaUrl ?? ""),
            userName: displayName,
            userAvatar:
              resolveUrl(avatarUrl ?? "") ||
              resolveUrl(
                (apiStories?.[0] as { thumbnailUrl?: string; mediaUrl?: string })?.thumbnailUrl ??
                  (apiStories?.[0] as { mediaUrl?: string })?.mediaUrl ??
                  ""
              ),
            time: formatPostTime((s as { createdAt?: string }).createdAt ?? ""),
            authorId: (s as { authorId?: string }).authorId ?? (authorId ?? undefined),
            expiresAt: (s as { expiresAt?: string }).expiresAt,
            likesCount: Number((s as { likesCount?: number }).likesCount ?? 0),
            isLiked: (s as { isLiked?: boolean }).isLiked === true,
          }))}
          initialIndex={Math.min(activeStoryIndex, (apiStories ?? []).length - 1)}
          onClose={() => setActiveStoryIndex(null)}
          viewerUserId={user?.id}
          canSeeViewers={isMe}
          onOpenViewers={(storyId) => setActiveViewersStoryId(storyId)}
          viewersCountByStoryId={storyViewersCountById}
          onStoryView={(storyId) => {
            if (!isMe) void recordStoryView(storyId);
          }}
          onReply={isMe ? undefined : handleStoryReply}
          canReply={!isMe}
          onToggleLike={handleStoryLikeToggle}
          canLike={!isMe}
          likedByStoryId={likedStoryIds}
          likesCountByStoryId={likesCountByStoryId}
          canManage={isMe}
          onShareStory={handleStoryShare}
          onArchiveStory={isMe ? handleStoryArchive : undefined}
          onDeleteStory={isMe ? handleStoryDelete : undefined}
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
          className="fixed inset-0 z-[380] flex items-end bg-black/45 px-3 pt-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))]"
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

      <CommentsModal isOpen={activeCommentPostId !== null} onClose={() => setActiveCommentPostId(null)} postId={activeCommentPostId} />
    </div>
  );

}
