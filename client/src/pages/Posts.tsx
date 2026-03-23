import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type ReactNode, type UIEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Share2,
  Plus,
  PenSquare,
  Eye,
  MoreHorizontal,
  Trash2,
  Camera,
  ImageIcon,
  User,
  Pencil,
  Check,
  Link2,
  Volume2,
  VolumeX,
  SmilePlus,
  Copy,
  EyeOff,
} from "lucide-react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { useLocation } from "wouter";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import {
  fetchFeed,
  formatPostTime,
  addReaction,
  removeReaction,
  recordPostView,
  updatePost,
  deletePost,
  sharePostToUser,
  savePost,
  unsavePost,
  type FeedPost,
  type ReactionUser,
} from "@/lib/posts";
import { applyReactionOptimistic, updateFeedPostInCache } from "@/lib/feed-query-cache";
import { createComment } from "@/lib/comments";
import { PostMedia } from "@/components/PostMedia";
import { PostExternalVideoEmbed } from "@/components/PostExternalVideoEmbed";
import { PostCaptionInlineParts } from "@/components/PostCaptionInlineParts";
import { extractFirstExternalVideoUrl, isExternalVideoOnlyCaption } from "@/lib/post-external-video";
import { parseExternalVideoUrl } from "@/lib/external-video";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { startDm } from "@/lib/search";
import { sendMessage } from "@/lib/chat";
import { useToast } from "@/hooks/use-toast";
import { resolveUrl } from "@/lib/api-base";
import {
  archiveStory,
  createStory,
  deleteStory,
  fetchStoriesFeedPage,
  fetchStoryViewers,
  likeStory,
  recordStoryView,
  unlikeStory,
  uploadStoryMedia,
  type StoriesFeedAuthor,
  type StoryViewerUser,
} from "@/lib/stories";
import { compressImage } from "@/lib/compress-image";
import { validateStoryVideoFile } from "@/lib/story-media";
import { getStoryBeautyEnabled, subscribeStoryPrefsChange } from "@/lib/story-prefs";
import { isNative, takePhotoFromCamera, pickPhotoFromGallery } from "@/lib/capacitor-native";
import { useLongPress } from "@/hooks/useLongPress";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { PageTitle } from "@/components/PageTitle";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ShatterEffect } from "@/components/ShatterEffect";
import { buildProfilePath, buildProfilePostPath } from "@/lib/profile-route";
import { FeedHeader } from "@/features/feed/components/FeedHeader";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { buildEdgeCompanionOpenHref } from "@/features/edge-companion/edge-companion-navigation";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { playLikeActionSound } from "@/lib/send-sound";
import { FeedScrollRootContext } from "@/contexts/FeedScrollRootContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  feedHiddenPostIdsStorageKey,
  loadHiddenFeedPostIds,
  persistHiddenFeedPostIds,
  withHiddenFeedPostId,
} from "@/lib/feed-hidden-posts";

import avatarMain from "@/assets/images/avatar-main.png";
import avatarAlisa from "@/assets/images/avatar-alisa.png";
import avatarDesign from "@/assets/images/avatar-design.png";
import avatarMom from "@/assets/images/avatar-mom.png";
import avatarNews from "@/assets/images/avatar-news.png";

const OTHER_STORIES = [
  { id: 1, name: "Алиса", avatar: avatarAlisa, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=1200&fit=crop", time: "1ч", isTrending: true },
  { id: 2, name: "Мама", avatar: avatarMom, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1490818387583-1baba5e638ce?w=800&h=1200&fit=crop", time: "3ч" },
  { id: 3, name: "Design", avatar: avatarDesign, isMe: false, hasUnseen: true, image: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=1200&fit=crop", time: "5ч" },
  { id: 4, name: "Новости", avatar: avatarNews, isMe: false, hasUnseen: false, image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=1200&fit=crop", time: "8ч", isTrending: true },
];

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];
const FEED_PAGE_SIZE = 5;
const FEED_RENDER_WINDOW_SIZE = 15;
/** Чуть шире видимой зоны — посты и медиа монтируются до скролла до них */
const FEED_RENDER_OVERSCAN = 5;
/** Картинки постов ниже окна виртуализации — прогрев через `Image()` до появления в DOM */
const FEED_MEDIA_PREFETCH_AHEAD = 10;
const FEED_POST_ESTIMATED_HEIGHT_PX = 560;
/** Пагинация ленты сториз по авторам (сервер: server/stories/service.ts DEFAULT_STORIES_FEED_AUTHOR_LIMIT). */
const STORIES_FEED_AUTHOR_PAGE = 18;

function collectFeedPostVisualMediaUrls(post: FeedPost): string[] {
  const raw = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
  return raw.filter((u) => !/\.(mp3|m4a|aac|wav|ogg)(\?|$)/i.test(u));
}

function isFeedPostVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

function MeasuredFeedItem({
  postId,
  viewerUserId,
  onHeightChange,
  children,
}: {
  postId: string;
  /** При авторизации один раз фиксируем просмотр поста при появлении в зоне видимости (как на экране поста). */
  viewerUserId?: string | null;
  onHeightChange: (postId: string, height: number) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewRecordedRef = useRef(false);

  useEffect(() => {
    viewRecordedRef.current = false;
  }, [postId]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    onHeightChange(postId, node.getBoundingClientRect().height);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      onHeightChange(postId, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [postId, onHeightChange]);

  useEffect(() => {
    if (!viewerUserId || viewRecordedRef.current) return;
    const node = rootRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || viewRecordedRef.current) return;
        viewRecordedRef.current = true;
        void recordPostView(postId).catch(() => {});
      },
      { threshold: 0.35, rootMargin: "0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [postId, viewerUserId]);

  return (
    <div ref={rootRef} data-post-id={postId}>
      {children}
    </div>
  );
}

function findPostIndexByOffset(offsets: number[], totalItems: number, targetOffset: number): number {
  if (totalItems <= 0) return 0;
  let low = 0;
  let high = totalItems;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (offsets[mid] <= targetOffset) low = mid;
    else high = mid - 1;
  }
  return Math.min(totalItems - 1, Math.max(0, low));
}

function FeedPostCaption({
  postId,
  text,
  expanded,
  onToggleExpand,
  onHashtagClick,
}: {
  postId: string;
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onHashtagClick: (tag: string) => void;
}) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [showToggle, setShowToggle] = useState(false);
  const primaryVideoUrl = useMemo(() => extractFirstExternalVideoUrl(text), [text]);
  const maskEmbed = useMemo(
    () => (primaryVideoUrl ? parseExternalVideoUrl(primaryVideoUrl) : null),
    [primaryVideoUrl],
  );

  useLayoutEffect(() => {
    const el = paragraphRef.current;
    if (!el) return;
    if (expanded) {
      setShowToggle(true);
      return;
    }
    const measure = () => {
      const node = paragraphRef.current;
      if (!node) return;
      setShowToggle(node.scrollHeight > node.clientHeight + 2);
    };
    measure();
    requestAnimationFrame(measure);
  }, [text, expanded, postId]);

  if (!text.trim()) return null;
  if (isExternalVideoOnlyCaption(text, primaryVideoUrl)) return null;

  return (
    <div className="min-w-0">
      <div
        className={cn(showToggle && !expanded && "cursor-pointer rounded-md -mx-0.5 px-0.5")}
        onClick={() => {
          if (showToggle && !expanded) onToggleExpand();
        }}
      >
        <p
          ref={paragraphRef}
          className={cn(
            "text-[15px] leading-snug tracking-[-0.01em] text-foreground whitespace-pre-wrap",
            !expanded && "line-clamp-2"
          )}
        >
          <PostCaptionInlineParts
            text={text}
            maskExternalEmbed={maskEmbed}
            onHashtagClick={onHashtagClick}
            linkClassName="text-primary underline decoration-primary/55 underline-offset-[3px] break-all"
            hashtagClassName="text-primary font-medium hover:underline underline-offset-2"
          />
        </p>
      </div>
      {showToggle && (
        <button
          type="button"
          className="mt-[var(--uix-space-2)] pl-0 text-[13px] font-semibold text-primary hover:underline underline-offset-2 min-h-[var(--uix-touch-min)] py-1 -my-1 text-left w-full sm:w-auto"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
        >
          {expanded ? "Свернуть" : "Ещё"}
        </button>
      )}
    </div>
  );
}

function FeedInlineCommentRow({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const t = text.trim();
    if (!t || !user) {
      if (!user) toast({ title: "Войдите, чтобы комментировать", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const created = await createComment(postId, t);
      setText("");
      if (created?.id) {
        updateFeedPostInCache(queryClient, postId, (p) => ({
          ...p,
          commentsCount: (p.commentsCount ?? 0) + 1,
          latestComments: [
            {
              id: created.id,
              postId: created.postId,
              userId: created.userId,
              text: created.text,
              createdAt: created.createdAt,
              user: created.user,
              avatar: created.avatar,
              likes: created.likes,
            },
            ...(p.latestComments ?? []),
          ].slice(0, 2),
        }));
      }
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <UserAvatar
        avatarUrl={user?.avatarUrl ?? undefined}
        displayName={[user?.displayName, user?.surname].filter(Boolean).join(" ") || "Вы"}
        seed={user?.id ?? "me"}
        size={28}
        className="h-7 w-7 shrink-0 rounded-lg"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void send();
          }
        }}
        placeholder="Комментировать…"
        disabled={sending || !user}
        className="min-h-[var(--uix-touch-min)] flex-1 rounded-full border border-border/50 bg-secondary/40 px-3 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        aria-label="Текст комментария"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending || !text.trim() || !user}
        className="shrink-0 rounded-full bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
      >
        {sending ? "…" : "Ок"}
      </button>
    </div>
  );
}

export default function Posts() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [editPost, setEditPost] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [shatteringPostIds, setShatteringPostIds] = useState<Set<string>>(new Set());
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);
  /** Один пост в ленте с включённым звуком видео (остальные muted). */
  const [feedSoundPostId, setFeedSoundPostId] = useState<string | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [activeViewersStoryId, setActiveViewersStoryId] = useState<string | null>(null);
  const [likedStoryIds, setLikedStoryIds] = useState<Record<string, boolean>>({});
  const [likesCountByStoryId, setLikesCountByStoryId] = useState<Record<string, number>>({});
  const [myAvatarMenu, setMyAvatarMenu] = useState(false);
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyCircleBeauty, setStoryCircleBeauty] = useState(getStoryBeautyEnabled);
  const [feedScrollTop, setFeedScrollTop] = useState(0);
  const [feedViewportHeight, setFeedViewportHeight] = useState(0);
  const [feedHeightsVersion, setFeedHeightsVersion] = useState(0);
  const storyFileRef = useRef<HTMLInputElement | null>(null);
  const storiesStripRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const postHeightsRef = useRef<Record<string, number>>({});
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isNativePlatform = isNative();
  const storyCircleFilter = storyCircleBeauty
    ? "saturate(1.1) contrast(1.08) brightness(1.04) hue-rotate(-2deg)"
    : "none";

  useEffect(() => {
    return subscribeStoryPrefsChange(() => setStoryCircleBeauty(getStoryBeautyEnabled()));
  }, []);

  const togglePostExpand = (postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const feedOpts = hashtagFilter ? { hashtag: hashtagFilter } : undefined;
  const {
    data: feedData,
    isLoading,
    isError,
    error: feedError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["posts", "feed", hashtagFilter ?? ""],
    queryFn: ({ pageParam }) => fetchFeed(FEED_PAGE_SIZE, pageParam as number, feedOpts),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!Array.isArray(lastPage)) return undefined;
      return lastPage.length < FEED_PAGE_SIZE ? undefined : allPages.length * FEED_PAGE_SIZE;
    },
  });
  const feedPosts: FeedPost[] = Array.isArray(feedData?.pages) ? feedData.pages.flat() : [];
  const hiddenStorageKey = useMemo(() => feedHiddenPostIdsStorageKey(user?.id), [user?.id]);
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenPostIds(loadHiddenFeedPostIds(hiddenStorageKey));
  }, [hiddenStorageKey]);

  const visibleFeedPosts = useMemo(
    () => feedPosts.filter((p) => !hiddenPostIds.has(p.id)),
    [feedPosts, hiddenPostIds],
  );

  const copyFeedPostLink = useCallback(
    (post: FeedPost) => {
      const url = `${window.location.origin}${buildProfilePostPath({
        postId: post.id,
        isMe: post.authorId === user?.id,
        publicId: post.author?.publicId,
        userId: post.authorId,
        fallbackPath: "/posts",
      })}`;
      if (!navigator.clipboard?.writeText) {
        toast({ title: "Копирование недоступно", variant: "destructive" });
        return;
      }
      void navigator.clipboard.writeText(url).then(
        () => toast({ title: "Ссылка скопирована" }),
        () => toast({ title: "Не удалось скопировать", variant: "destructive" }),
      );
    },
    [toast, user?.id],
  );

  const hidePostFromFeed = useCallback(
    (postId: string) => {
      setHiddenPostIds((prev) => {
        const next = withHiddenFeedPostId(prev, postId);
        persistHiddenFeedPostIds(hiddenStorageKey, next);
        return next;
      });
      toast({ title: "Пост скрыт из ленты", description: "Только на этом устройстве." });
    },
    [hiddenStorageKey, toast],
  );

  const clearHiddenFeedPosts = useCallback(() => {
    setHiddenPostIds(new Set());
    persistHiddenFeedPostIds(hiddenStorageKey, new Set());
  }, [hiddenStorageKey]);

  const updateFeedPostHeight = useCallback((postId: string, height: number) => {
    if (!Number.isFinite(height) || height <= 0) return;
    const rounded = Math.round(height);
    const prev = postHeightsRef.current[postId];
    if (prev != null && Math.abs(prev - rounded) < 2) return;
    postHeightsRef.current[postId] = rounded;
    setFeedHeightsVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    const existingIds = new Set(feedPosts.map((p) => p.id));
    let changed = false;
    for (const postId of Object.keys(postHeightsRef.current)) {
      if (!existingIds.has(postId)) {
        delete postHeightsRef.current[postId];
        changed = true;
      }
    }
    if (changed) setFeedHeightsVersion((v) => v + 1);
  }, [feedPosts]);

  useEffect(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    const sync = () => {
      setFeedScrollTop(el.scrollTop);
      setFeedViewportHeight(el.clientHeight);
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const feedVirtualization = useMemo(() => {
    const totalItems = visibleFeedPosts.length;
    if (totalItems === 0) {
      return {
        startIndex: 0,
        endIndexExclusive: 0,
        topSpacerPx: 0,
        bottomSpacerPx: 0,
      };
    }

    const offsets = new Array<number>(totalItems + 1);
    offsets[0] = 0;
    for (let i = 0; i < totalItems; i += 1) {
      const row = visibleFeedPosts[i];
      const h = row ? (postHeightsRef.current[row.id] ?? FEED_POST_ESTIMATED_HEIGHT_PX) : FEED_POST_ESTIMATED_HEIGHT_PX;
      offsets[i + 1] = offsets[i] + h;
    }

    const viewportTop = Math.max(0, feedScrollTop);
    const viewportBottom = viewportTop + Math.max(1, feedViewportHeight);
    const visibleStart = Math.max(0, findPostIndexByOffset(offsets, totalItems, viewportTop) - FEED_RENDER_OVERSCAN);
    const visibleEnd = Math.min(totalItems, findPostIndexByOffset(offsets, totalItems, viewportBottom) + 1 + FEED_RENDER_OVERSCAN);

    let startIndex = visibleStart;
    let endIndexExclusive = visibleEnd;
    if (endIndexExclusive - startIndex > FEED_RENDER_WINDOW_SIZE) {
      startIndex = Math.max(0, endIndexExclusive - FEED_RENDER_WINDOW_SIZE);
    }
    if (endIndexExclusive - startIndex < FEED_RENDER_WINDOW_SIZE) {
      endIndexExclusive = Math.min(totalItems, startIndex + FEED_RENDER_WINDOW_SIZE);
    }

    const topSpacerPx = offsets[startIndex] ?? 0;
    const bottomSpacerPx = Math.max(0, (offsets[totalItems] ?? 0) - (offsets[endIndexExclusive] ?? 0));
    return { startIndex, endIndexExclusive, topSpacerPx, bottomSpacerPx };
  }, [visibleFeedPosts, feedScrollTop, feedViewportHeight, feedHeightsVersion]);

  const feedEndExclusive = feedVirtualization.endIndexExclusive;
  useEffect(() => {
    if (!Array.isArray(feedData?.pages)) return;
    const posts = feedData.pages.flat() as FeedPost[];
    const start = feedEndExclusive;
    const end = Math.min(posts.length, start + FEED_MEDIA_PREFETCH_AHEAD);
    if (start >= end) return;
    const seen = new Set<string>();
    for (let i = start; i < end; i++) {
      const post = posts[i];
      if (!post) continue;
      for (const u of collectFeedPostVisualMediaUrls(post)) {
        if (isFeedPostVideoMediaUrl(u)) continue;
        const abs = resolveUrl(u);
        if (seen.has(abs)) continue;
        seen.add(abs);
        const img = new Image();
        img.decoding = "async";
        img.src = abs;
      }
    }
  }, [feedData?.pages, feedEndExclusive]);

  const renderedFeedPosts = feedPosts.slice(feedVirtualization.startIndex, feedVirtualization.endIndexExclusive);
  const feedErrorText =
    feedError instanceof Error && feedError.message.trim()
      ? feedError.message
      : "Проверьте интернет и попробуйте снова";

  // Подгрузка следующей страницы при скролле до конца списка (после useInfiniteQuery)
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { rootMargin: "520px 0px 520px 0px", threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Сохранение и восстановление позиции скролла ленты
  useEffect(() => {
    const key = "ping-feed-scroll-y";
    const el = feedScrollRef.current;
    if (el) {
      const saved = Number(sessionStorage.getItem(key) ?? "0");
      if (saved > 0) {
        requestAnimationFrame(() => {
          el.scrollTo({ top: saved });
        });
      }
    }
    return () => {
      const current = feedScrollRef.current?.scrollTop ?? 0;
      sessionStorage.setItem(key, String(current));
    };
  }, []);

  const { data: contactsForShare = [] } = useQuery({
    queryKey: ["contacts", "list"],
    queryFn: listContactsWithProfiles,
    enabled: sharePostId !== null,
  });

  const {
    data: storiesPagesData,
    isLoading: storiesLoading,
    isError: storiesError,
    refetch: refetchStories,
    fetchNextPage: fetchNextStoriesPage,
    hasNextPage: storiesHasNextPage,
    isFetchingNextPage: storiesFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["stories", "feed"],
    queryFn: ({ pageParam }) =>
      fetchStoriesFeedPage({
        offset: typeof pageParam === "number" ? pageParam : 0,
        limit: STORIES_FEED_AUTHOR_PAGE,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!user,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const storiesFeed = useMemo(() => {
    const pages = storiesPagesData?.pages;
    if (!pages?.length) return [];
    const ordered: StoriesFeedAuthor[] = [];
    const seen = new Set<string>();
    for (const p of pages) {
      for (const a of p.authors) {
        if (seen.has(a.authorId)) continue;
        seen.add(a.authorId);
        ordered.push(a);
      }
    }
    return ordered;
  }, [storiesPagesData?.pages]);

  const onStoriesStripScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const t = e.currentTarget;
      if (t.scrollLeft + t.clientWidth >= t.scrollWidth - 120 && storiesHasNextPage && !storiesFetchingNextPage) {
        void fetchNextStoriesPage();
      }
    },
    [fetchNextStoriesPage, storiesHasNextPage, storiesFetchingNextPage],
  );

  /** Прогрев превью последних подгруженных кружков — быстрее открытие просмотра. */
  useEffect(() => {
    if (!storiesFeed.length) return;
    const tail = storiesFeed.slice(-4);
    const seen = new Set<string>();
    for (const a of tail) {
      const first = a.stories?.[0];
      const raw = first?.mediaUrl?.trim();
      if (!raw) continue;
      if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(raw)) continue;
      const abs = resolveUrl(raw);
      if (seen.has(abs)) continue;
      seen.add(abs);
      const img = new Image();
      img.decoding = "async";
      img.src = abs;
    }
  }, [storiesFeed]);

  const { data: activeStoryViewers = [], isLoading: activeStoryViewersLoading } = useQuery({
    queryKey: ["stories", "viewers", activeViewersStoryId],
    queryFn: () => fetchStoryViewers(activeViewersStoryId!),
    enabled: !!activeViewersStoryId,
  });

  useEffect(() => {
    const nextLiked: Record<string, boolean> = {};
    const nextLikesCount: Record<string, number> = {};
    for (const author of storiesFeed) {
      for (const story of author.stories ?? []) {
        nextLiked[story.id] = story.isLiked === true;
        nextLikesCount[story.id] = Number(story.likesCount ?? 0);
      }
    }
    setLikedStoryIds(nextLiked);
    setLikesCountByStoryId(nextLikesCount);
  }, [storiesFeed]);

  const handleFeedRefresh = useCallback(async () => {
    await Promise.allSettled([
      refetch(),
      refetchStories(),
      queryClient.invalidateQueries({ queryKey: ["posts", "feed"] }),
      queryClient.invalidateQueries({ queryKey: ["stories", "feed"] }),
    ]);
  }, [queryClient, refetch, refetchStories]);

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string | null }) => {
      if (emoji) await addReaction(postId, emoji);
      else await removeReaction(postId);
    },
    onMutate: async ({ postId, emoji }) => {
      await queryClient.cancelQueries({ queryKey: ["posts", "feed"] });
      const previous = queryClient.getQueriesData({ queryKey: ["posts", "feed"] });
      updateFeedPostInCache(queryClient, postId, (p) => applyReactionOptimistic(p, emoji));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      ctx?.previous?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast({
        title: e instanceof Error ? e.message : "Не удалось обновить реакцию",
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
  });

  const savePostMutation = useMutation({
    mutationFn: async ({ postId, save }: { postId: string; save: boolean }) => {
      if (save) await savePost(postId);
      else await unsavePost(postId);
    },
    onMutate: async ({ postId, save }) => {
      await queryClient.cancelQueries({ queryKey: ["posts", "feed"] });
      const previous = queryClient.getQueriesData({ queryKey: ["posts", "feed"] });
      updateFeedPostInCache(queryClient, postId, (p) => ({ ...p, isSaved: save }));
      return { previous };
    },
    onError: (e, _v, ctx) => {
      ctx?.previous?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast({ title: e instanceof Error ? e.message : "Не удалось сохранить", variant: "destructive" });
    },
    onSuccess: (_d, { save }) => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      toast({ title: save ? "Сохранено в профиль" : "Убрано из сохранённого" });
    },
  });

  const shareToUserMutation = useMutation({
    mutationFn: ({ postId, toUserId }: { postId: string; toUserId: string }) => sharePostToUser(postId, toUserId),
    onSuccess: (data) => {
      setSharePostId(null);
      toast({ title: "Пост отправлен в чат" });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      setLocation(`/chat/${encodeURIComponent(data.chatId)}`);
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" }),
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ postId, text, imageUrl, mediaUrls }: { postId: string; text: string; imageUrl?: string | null; mediaUrls?: string[] | null }) =>
      updatePost(postId, { text, imageUrl, mediaUrls }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      setEditPost(null);
      toast({ title: "Пост обновлён" });
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => { /* инвалидация и тост — после анимации рассыпания в onComplete */ },
    onError: (e, postId) => {
      setShatteringPostIds((s) => {
        const n = new Set(s);
        n.delete(postId);
        return n;
      });
      toast({ title: e instanceof Error ? e.message : "Ошибка удаления", variant: "destructive" });
    },
  });

  const currentUserName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль" : "Профиль";
  const myStoryAvatar = user?.avatarUrl ? resolveUrl(user.avatarUrl) : avatarMain;

  const storyCircles = !user || (storiesError && storiesFeed.length === 0)
    ? []
    : storiesFeed.length > 0
    ? (() => {
        const mapped = storiesFeed.map((a) => {
          const author = a.author ?? { id: a.authorId, publicId: 0, displayName: null, avatarUrl: null };
          const now = Date.now();
          const stories = (Array.isArray(a.stories) ? a.stories : []).filter((s) => {
            const ex = Date.parse(String(s.expiresAt ?? ""));
            return Number.isFinite(ex) && ex > now;
          });
          const hasLocalUnseen = stories.some((s) => !viewedStoryIds.has(s.id) && s.isViewed !== true);
          const isMe = user ? a.authorId === user.id : false;
          return {
            id: a.authorId,
            name: isMe ? "Моя история" : author.displayName || `ID ${author.publicId}`,
            avatar: author.avatarUrl ? resolveUrl(author.avatarUrl) : avatarMain,
            isMe,
            hasActive: stories.length > 0,
            hasUnseen: isMe ? false : hasLocalUnseen || a.hasUnseen === true,
            image: stories[0]?.mediaUrl ? resolveUrl(stories[0].mediaUrl) : "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop",
            time: stories[0]?.createdAt ? formatPostTime(stories[0].createdAt) : "",
            stories,
            author,
          };
        }).filter((row) => row.stories.length > 0 || (user && row.id === user.id));

        const myIndex = mapped.findIndex((s) => s.isMe);
        if (myIndex >= 0) {
          const [me] = mapped.splice(myIndex, 1);
          return [me, ...mapped];
        }

        return [
          {
            id: "me",
            name: "Моя история",
            avatar: myStoryAvatar,
            isMe: true,
            hasActive: false,
            hasUnseen: false,
            image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop",
            time: "",
            stories: [],
            author: null,
          },
          ...mapped,
        ];
      })()
    : [
        { id: "me", name: "Моя история", avatar: myStoryAvatar, isMe: true, hasActive: false, hasUnseen: false, image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop", time: "5м", views: 128, stories: [], author: null },
        ...OTHER_STORIES.map((s) => ({ ...s, hasActive: true, stories: [], author: null })),
      ];

  const getViewerStoriesForIndex = useCallback((idx: number) => {
    const item = storyCircles[idx];
    if (!item || !("stories" in item) || !Array.isArray(item.stories) || item.stories.length === 0) {
      const rawId = item && "id" in item ? (item as { id: unknown }).id : idx;
      const storyId = String(rawId ?? idx);
      const authorIdFromCircle =
        item &&
        typeof (item as { id?: unknown }).id === "string" &&
        (item as { id: string }).id !== "me"
          ? (item as { id: string }).id
          : (item as { author?: { id?: string } })?.author?.id ?? "";
      return [
        {
          id: storyId,
          authorId: authorIdFromCircle,
          image: (item as { image?: string })?.image ?? "",
          userName: (item as { name?: string })?.name ?? "",
          userAvatar: (item as { avatar?: string })?.avatar ?? "",
          time: (item as { time?: string })?.time ?? "",
        },
      ];
    }
    const author = (item as { author?: { id?: string; displayName: string | null; avatarUrl: string | null; publicId: number } }).author;
    const name = author?.displayName || (item as { name?: string }).name || `ID ${author?.publicId ?? ""}`;
    const avatar = author?.avatarUrl ? resolveUrl(author.avatarUrl) : (item as { avatar?: string }).avatar ?? avatarMain;
    const circleUserId =
      typeof (item as { id?: unknown }).id === "string" && (item as { id: string }).id !== "me"
        ? (item as { id: string }).id
        : "";
    return (item.stories as {
      id: string;
      mediaUrl: string;
      thumbnailUrl?: string | null;
      createdAt: string;
      expiresAt?: string;
      likesCount?: number;
      isLiked?: boolean;
    }[]).map((s) => {
      const slideAuthorId = author?.id ?? (item as { authorId?: string }).authorId ?? circleUserId;
      const thumb = s.thumbnailUrl?.trim();
      return {
        id: s.id,
        image: resolveUrl(s.mediaUrl),
        ...(thumb ? { thumbnailUrl: resolveUrl(thumb) } : {}),
        userName: name,
        userAvatar: avatar,
        time: formatPostTime(s.createdAt),
        authorId: slideAuthorId || undefined,
        expiresAt: s.expiresAt,
        likesCount: Number(s.likesCount ?? 0),
        isLiked: s.isLiked === true,
      };
    });
  }, [storyCircles]);

  /** Для записи просмотра: в цепочке сториз автор слайда не совпадает с кругом, с которого открыли. */
  const storyAuthorIdByStoryId = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of storiesFeed ?? []) {
      const aid = a.authorId;
      for (const s of a.stories ?? []) {
        m.set(s.id, aid);
      }
    }
    return m;
  }, [storiesFeed]);

  /** Все авторы с непустыми сториз по порядку кольца — свайп ведёт к следующему аккаунту. */
  const chainedStoryViewerModel = useMemo(() => {
    if (activeStoryIndex === null) return null;
    const openedIdx = activeStoryIndex;
    const itemAtOpen = storyCircles[openedIdx];
    const hasAtOpen =
      !!itemAtOpen &&
      "stories" in itemAtOpen &&
      Array.isArray(itemAtOpen.stories) &&
      itemAtOpen.stories.length > 0;

    if (!hasAtOpen) {
      return { stories: getViewerStoriesForIndex(openedIdx), initialIndex: 0 };
    }

    type StoryViewerSlide = ReturnType<typeof getViewerStoriesForIndex>[number];
    const flat: StoryViewerSlide[] = [];
    let initialIndex = 0;
    let sawOpen = false;

    for (let i = 0; i < storyCircles.length; i++) {
      const item = storyCircles[i];
      const hasReal =
        !!item && "stories" in item && Array.isArray(item.stories) && item.stories.length > 0;
      if (!hasReal) continue;
      if (i === openedIdx) {
        initialIndex = flat.length;
        sawOpen = true;
      }
      for (const slide of getViewerStoriesForIndex(i)) {
        flat.push(slide);
      }
    }

    if (!sawOpen || flat.length === 0) {
      return { stories: getViewerStoriesForIndex(openedIdx), initialIndex: 0 };
    }
    return { stories: flat, initialIndex };
  }, [activeStoryIndex, storyCircles, getViewerStoriesForIndex]);

  const handleStoryReply = async (payload: {
    storyId: string;
    authorId: string;
    text: string;
    story: { id: string; image: string; thumbnailUrl?: string; userName: string; userAvatar: string; time: string };
  }) => {
    if (!user?.id) {
      toast({ title: "Войдите, чтобы ответить на сториз", variant: "destructive" });
      throw new Error("Не авторизован");
    }
    if (!payload.authorId || payload.authorId === user.id) {
      toast({ title: "Нельзя отправить ответ на свой сториз", variant: "destructive" });
      throw new Error("Нельзя ответить на свой сториз");
    }
    try {
      const chat = await startDm(payload.authorId);
      const storyPayload = {
        storyId: payload.story.id,
        mediaUrl: payload.story.image,
        ...(payload.story.thumbnailUrl ? { thumbnailUrl: payload.story.thumbnailUrl } : {}),
        authorId: payload.authorId,
        authorName: payload.story.userName,
        authorAvatar: payload.story.userAvatar,
        storyTimeLabel: payload.story.time,
        replyText: payload.text.trim(),
      };
      await sendMessage(chat.id, { type: "story_reply", content: JSON.stringify(storyPayload) });
      void queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      toast({ title: "Ответ на сториз отправлен" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Не удалось отправить ответ";
      toast({ title: msg, variant: "destructive" });
      throw e instanceof Error ? e : new Error(msg);
    }
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
      void queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
    } catch (err) {
      setLikedStoryIds((prev) => ({ ...prev, [storyId]: prevLiked }));
      setLikesCountByStoryId((prev) => ({ ...prev, [storyId]: prevCount }));
      toast({ title: err instanceof Error ? err.message : "Не удалось обновить лайк", variant: "destructive" });
    }
  };

  const handleStoryShare = async (story: { id: string; image: string; userName: string; time: string }) => {
    const shareText = `Сториз ${story.userName}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: shareText, text: shareText, url: story.image });
      } catch (e) {
        if (isNavigatorShareCancelled(e)) return;
        throw e;
      }
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

  /* ---------- Story upload (Instagram-like) ---------- */
  const triggerStoryFilePicker = () => {
    if (isNativePlatform) {
      setMyAvatarMenu(false);
      void pickPhotoFromGallery()
        .then(async (dataUrl) => {
          if (!dataUrl) return;
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], "story.jpg", { type: blob.type || "image/jpeg" });
          await handleStoryFileUpload(file);
        })
        .catch(() => toast({ title: "Не удалось открыть галерею", variant: "destructive" }));
      return;
    }
    storyFileRef.current?.click();
    setMyAvatarMenu(false);
  };

  const triggerStoryCamera = async () => {
    setMyAvatarMenu(false);
    try {
      const dataUrl = await takePhotoFromCamera();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], "story-cam.jpg", { type: blob.type || "image/jpeg" });
      await handleStoryFileUpload(file);
    } catch {
      toast({ title: "Не удалось открыть камеру", variant: "destructive" });
    }
  };

  const handleStoryFileUpload = async (file: File) => {
    if (storyUploading) return;
    setStoryUploading(true);
    try {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        const videoValidationError = validateStoryVideoFile(file);
        if (videoValidationError) throw new Error(videoValidationError);
      }
      const toUpload = isImage ? await compressImage(file) : file;
      const mediaUrl = await uploadStoryMedia(toUpload);
      await createStory(mediaUrl);
      toast({ title: "Сториз опубликована" });
      await refetchStories();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки сториз", variant: "destructive" });
    } finally {
      setStoryUploading(false);
    }
  };

  const onStoryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await handleStoryFileUpload(file);
  };

  const longPressActiveRef = useRef(false);
  const myCircleLongPress = useLongPress({
    durationMs: 600,
    onLongPress: () => {
      longPressActiveRef.current = true;
      setMyAvatarMenu(true);
    },
  });
  const storyCirclePointerRef = useRef<{
    id: string | null;
    x: number;
    y: number;
    moved: boolean;
  }>({
    id: null,
    x: 0,
    y: 0,
    moved: false,
  });

  const onStoryCirclePointerDown = (id: string, e: React.PointerEvent<HTMLDivElement>) => {
    storyCirclePointerRef.current = {
      id,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  };

  const onStoryCirclePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = storyCirclePointerRef.current;
    if (!state.id || state.moved) return;
    const dx = Math.abs(e.clientX - state.x);
    const dy = Math.abs(e.clientY - state.y);
    if (dx > 10 || dy > 8) state.moved = true;
  };

  const onStoryCirclePointerCancel = () => {
    storyCirclePointerRef.current = { id: null, x: 0, y: 0, moved: false };
  };

  const handleMyCircleTap = () => {
    if (longPressActiveRef.current) {
      longPressActiveRef.current = false;
      return;
    }
    if (myAvatarMenu) return;
    const myCircle = storyCircles[0];
    if (myCircle && (myCircle as { hasActive?: boolean }).hasActive) {
      setActiveStoryIndex(0);
    } else {
      triggerStoryFilePicker();
    }
  };

  return (
    <div className="flex flex-1 min-h-0 h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-background">
      <PageTitle title="Лента" />
      <div className="w-full max-w-full min-w-0 flex-1 min-h-0 flex flex-col bg-background">
        
        <FeedHeader
          displayName={currentUserName}
          onOpenProfile={() => setLocation("/profile/me")}
          onOpenCreatePost={() => setLocation("/create-post")}
        />

        {/* Feed Content */}
        <PullToRefresh
          onRefresh={handleFeedRefresh}
          showScrollToTop
          className="min-w-0"
          scrollRef={feedScrollRef}
        >
          <FeedScrollRootContext.Provider value={feedScrollRef}>
          {/* Stories Section */}
          <div className="py-4 border-b border-border/50 bg-background/50">
            <div
              ref={storiesStripRef}
              onScroll={onStoriesStripScroll}
              className="flex gap-4 overflow-x-auto hide-scrollbar uix-content-x items-center"
            >
              {storiesError && storyCircles.length === 0 && user && (
                <button
                  type="button"
                  onClick={() => refetchStories()}
                  className="flex-shrink-0 px-3 py-2 rounded-xl bg-secondary text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Обновить сториз
                </button>
              )}
              {/* Hidden file input for story upload */}
              <input
                ref={storyFileRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => void onStoryFileChange(e)}
              />
              {storyCircles.map((story, idx) => {
                const isMe = (story as { isMe?: boolean }).isMe === true;
                return (
                <div 
                  key={String(story.id)} 
                  className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
                  onPointerDown={(e) => {
                    onStoryCirclePointerDown(String(story.id), e);
                    if (isMe) {
                      longPressActiveRef.current = false;
                      myCircleLongPress.onPointerDown();
                    }
                  }}
                  onPointerMove={onStoryCirclePointerMove}
                  onPointerUp={() => {
                    if (isMe) myCircleLongPress.onPointerUp();
                    const state = storyCirclePointerRef.current;
                    const isTap = state.id === String(story.id) && !state.moved;
                    storyCirclePointerRef.current = { id: null, x: 0, y: 0, moved: false };
                    if (!isTap) return;
                    if (isMe) {
                      handleMyCircleTap();
                    } else {
                      setActiveStoryIndex(idx);
                    }
                  }}
                  onPointerCancel={() => {
                    onStoryCirclePointerCancel();
                    if (isMe) myCircleLongPress.onPointerCancel();
                  }}
                  onPointerLeave={() => {
                    onStoryCirclePointerCancel();
                    if (isMe) myCircleLongPress.onPointerLeave();
                  }}
                >
                  <div className="relative">
                    <div className={cn(
                      "w-16 h-16 rounded-full p-[2px] transition-transform duration-200 group-active:scale-95",
                      isMe && storyUploading && "animate-pulse",
                      (story as { hasUnseen?: boolean }).hasUnseen
                        ? "bg-gradient-to-tr from-primary via-fuchsia-500 to-purple-500 animate-story-ring"
                        : (story as { hasActive?: boolean }).hasActive
                          ? "bg-gradient-to-tr from-primary/80 to-purple-400/70"
                          : "bg-border"
                    )}>
                      <img 
                        src={(story as { avatar?: string }).avatar ?? avatarMain} 
                        alt={(story as { name?: string }).name ?? ""} 
                        style={{ filter: storyCircleFilter }}
                        className="w-full h-full rounded-full object-cover border-2 border-background"
                      />
                    </div>
                    {isMe && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (storyUploading) return;
                          setMyAvatarMenu(true);
                        }}
                        className={cn(
                          "absolute -bottom-1 -right-1 z-10 flex h-11 w-11 items-end justify-end border-0 bg-transparent p-0 transition-transform active:scale-95"
                        )}
                        aria-label="Открыть меню моей истории"
                        disabled={storyUploading}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-background text-white shadow-md transition-colors",
                            storyUploading ? "bg-amber-500" : "bg-primary hover:bg-primary/90 active:bg-primary/80"
                          )}
                        >
                          {storyUploading ? (
                            <span
                              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
                              aria-hidden
                            />
                          ) : (
                            <Plus className="h-4 w-4" strokeWidth={2.75} aria-hidden />
                          )}
                        </span>
                      </button>
                    )}
                    {"isTrending" in story && story.isTrending && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm border-[1.5px] border-background px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-10 animate-[pulse_2s_ease-in-out_infinite]">
                        <span className="text-[9px] font-bold tracking-wide uppercase leading-none">HOT</span>
                      </div>
                    )}
                    {"views" in story && story.views !== undefined && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground shadow-sm border border-background px-1.5 py-0.5 rounded-full flex items-center gap-1 z-10">
                        <Eye className="w-3 h-3 opacity-70" />
                        <span className="text-[10px] font-semibold leading-none">{story.views}</span>
                      </div>
                    )}
                  </div>
                  <span className={cn(
                    "text-[11px] font-medium text-foreground/80 max-w-[64px] truncate text-center",
                    ("isTrending" in story && story.isTrending) || ("views" in story && story.views !== undefined) ? "mt-1.5" : ""
                  )}>
                    {(story as { name?: string }).name ?? ""}
                  </span>
                </div>
                );
              })}
              {storiesLoading && storyCircles.length === 0 && (
                <div className="flex-shrink-0 text-xs text-muted-foreground">Загрузка сториз...</div>
              )}
              {storiesFetchingNextPage && (
                <div
                  className="flex flex-col items-center gap-1.5 flex-shrink-0 py-1"
                  aria-label="Подгрузка сториз"
                >
                  <div className="h-16 w-16 shrink-0 rounded-full bg-muted/55 animate-pulse" />
                  <div className="h-2.5 w-10 rounded-full bg-muted/45 animate-pulse" />
                </div>
              )}
            </div>
          </div>

          {hashtagFilter && (
            <div className="uix-content-x-tight py-2 flex items-center gap-2 border-b border-border/50 bg-secondary/20">
              <span className="text-sm text-muted-foreground">Хештег:</span>
              <span className="font-medium text-primary">#{hashtagFilter}</span>
              <button
                type="button"
                onClick={() => setHashtagFilter(null)}
                className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Сбросить
              </button>
            </div>
          )}

          {/* Posts List */}
          <div className="flex flex-col min-h-[40vh]">
            {isLoading && feedPosts.length === 0 ? (
              <LoadingProgress loading minHeight="280px" className="rounded-lg">
                <div className="min-h-[280px]" />
              </LoadingProgress>
            ) : isError && feedPosts.length === 0 ? (
              <ErrorWithRetry
                title="Не удалось загрузить ленту"
                description={feedErrorText}
                onRetry={() => refetch()}
              />
            ) : feedPosts.length === 0 ? (
              <ListEmptyState
                icon={PenSquare}
                title="Пока нет постов"
                description="Напишите первый пост — им поделятся в ленте"
                actionLabel="Написать первый пост"
                onAction={() => setLocation("/create-post")}
              />
            ) : visibleFeedPosts.length === 0 ? (
              <ListEmptyState
                icon={EyeOff}
                title="Посты скрыты"
                description="Вы скрыли все видимые посты на этом устройстве. Новые посты появятся в ленте как обычно."
                actionLabel="Показать скрытые снова"
                onAction={clearHiddenFeedPosts}
              />
            ) : (
              <>
              {feedVirtualization.topSpacerPx > 0 && (
                <div style={{ height: `${feedVirtualization.topSpacerPx}px` }} aria-hidden />
              )}
              {renderedFeedPosts.map((post: FeedPost) => {
                const isShattering = shatteringPostIds.has(post.id);
                const safeText = post.text ?? "";
                const authorProfilePath = buildProfilePath({
                  isMe: post.authorId === user?.id,
                  publicId: post.author?.publicId,
                  userId: post.authorId,
                  fallbackPath: "/posts",
                });
                const postDetailPath = buildProfilePostPath({
                  postId: post.id,
                  isMe: post.authorId === user?.id,
                  publicId: post.author?.publicId,
                  userId: post.authorId,
                  fallbackPath: "/posts",
                });
                const latestComments = Array.isArray(post.latestComments) ? post.latestComments : [];
                const lastComment = [...latestComments].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0];
                const reactionTotal =
                  post.reactions?.reduce((sum: number, r: { count: number }) => sum + r.count, 0) ?? 0;
                const topThreeReactionEmojis = [...(post.reactions ?? [])]
                  .filter((r) => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((r) => r.emoji);
                const sharesCount = post.sharesCount ?? 0;
                const mediaList = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
                const postHasVideo = mediaList.some((u) => /\.(mp4|webm|mov)(\?|$)/i.test(u));
                const feedVideoSoundOn = feedSoundPostId === post.id;
                const primaryExternalVideoUrl = extractFirstExternalVideoUrl(safeText);
                const article = (
              <article className="overflow-x-hidden border-b border-border/40 transition-colors duration-200 ease-out hover:bg-secondary/15">
                <div className="flex items-start justify-between gap-[var(--uix-space-3)] uix-content-x pb-[var(--uix-space-3)] pt-[var(--uix-space-4)]">
                  <div
                    className="group flex min-w-0 flex-1 cursor-pointer items-center gap-[var(--uix-space-3)]"
                    onClick={() => setLocation(authorProfilePath)}
                  >
                    <UserAvatar
                      avatarUrl={post.author?.avatarUrl ?? undefined}
                      displayName={post.channelName || (post.author ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ") : null) || `ID ${post.author?.publicId ?? post.authorId}`}
                      seed={String(post.authorId)}
                      size={40}
                      className="h-10 w-10 flex-shrink-0 rounded-xl object-cover transition-opacity group-hover:opacity-80"
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        className="truncate text-[15px] font-semibold leading-tight transition-colors group-hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(postDetailPath);
                        }}
                      >
                        {post.channelName || (post.author ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ") : null) || `ID ${post.author?.publicId ?? post.authorId}`}
                      </h3>
                      <p
                        className="mt-[var(--uix-space-1)] uix-text-caption cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(postDetailPath);
                        }}
                      >
                        {formatPostTime(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    {user && mediaList.length === 0 && (
                      <button
                        type="button"
                        className="flex h-9 w-9 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
                        aria-label={post.isSaved ? "Убрать из сохранённого" : "Сохранить пост"}
                        disabled={savePostMutation.isPending && savePostMutation.variables?.postId === post.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                          savePostMutation.mutate({ postId: post.id, save: !post.isSaved });
                        }}
                      >
                        {post.isSaved ? <Check className="h-5 w-5 text-primary" strokeWidth={2.25} /> : <Plus className="h-5 w-5" />}
                      </button>
                    )}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
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
                            onClick={() => copyFeedPostLink(post)}
                          >
                            <Copy className="h-4 w-4" />
                            Скопировать ссылку
                          </DropdownMenuItem>
                          {user && post.authorId !== user.id ? (
                            <DropdownMenuItem
                              className="min-h-[var(--uix-touch-min)]"
                              onClick={() => hidePostFromFeed(post.id)}
                            >
                              <EyeOff className="h-4 w-4" />
                              Скрыть из ленты
                            </DropdownMenuItem>
                          ) : null}
                          {post.authorId === user?.id ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="min-h-[var(--uix-touch-min)]"
                                onClick={() => {
                                  setEditPost(post);
                                  setEditText(post.text);
                                  setEditImageUrl(post.imageUrl ?? "");
                                }}
                              >
                                <PenSquare className="h-4 w-4" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="min-h-[var(--uix-touch-min)] text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (window.confirm("Удалить пост?")) {
                                    setShatteringPostIds((s) => new Set(s).add(post.id));
                                    deletePostMutation.mutate(post.id);
                                  }
                                }}
                                disabled={deletePostMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                                Удалить пост
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {mediaList.length > 0 && (
                  <div className="relative w-full">
                    <PostMedia
                      mediaUrls={mediaList}
                      layout={post.mediaLayout ?? null}
                      edgeToEdge
                      feedEagerImages
                      feedVideoAutoplay
                      feedVideoSoundOn={feedVideoSoundOn}
                      feedReelsInteraction={
                        user
                          ? {
                              onDoubleTapFire: () => {
                                void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                                  triggerLightHaptic(),
                                );
                                playLikeActionSound();
                                const mine = post.myReaction;
                                reactionMutation.mutate({
                                  postId: post.id,
                                  emoji: mine === "🔥" ? null : "🔥",
                                });
                              },
                            }
                          : null
                      }
                    />
                    {user ? (
                      <div className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-2 z-10 flex items-center gap-1.5">
                        {postHasVideo ? (
                          <button
                            type="button"
                            className="flex h-8 w-8 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm backdrop-blur-sm transition-transform active:scale-90"
                            aria-label={feedVideoSoundOn ? "Выключить звук видео" : "Включить звук видео"}
                            onClick={(e) => {
                              e.stopPropagation();
                              void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                              setFeedSoundPostId((cur) => (cur === post.id ? null : post.id));
                            }}
                          >
                            {feedVideoSoundOn ? (
                              <Volume2 className="h-4 w-4 opacity-95" strokeWidth={2.25} aria-hidden />
                            ) : (
                              <VolumeX className="h-4 w-4 opacity-90" strokeWidth={2.25} aria-hidden />
                            )}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="flex h-8 w-8 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-sm backdrop-blur-sm transition-transform active:scale-90"
                          aria-label={post.isSaved ? "Убрать из сохранённого" : "Сохранить пост в профиль"}
                          disabled={savePostMutation.isPending && savePostMutation.variables?.postId === post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                            savePostMutation.mutate({ postId: post.id, save: !post.isSaved });
                          }}
                        >
                          {post.isSaved ? (
                            <Check className="h-4 w-4 text-emerald-300" strokeWidth={2.5} />
                          ) : (
                            <Plus className="h-4 w-4" strokeWidth={2.5} />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {post.edgeId ? (
                  <div className="relative w-full">
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
                        setLocation(buildEdgeCompanionOpenHref(post.edgeId!, "/posts"));
                      }}
                    />
                  </div>
                ) : null}

                {primaryExternalVideoUrl ? (
                  <div className="relative w-full">
                    <PostExternalVideoEmbed url={primaryExternalVideoUrl} flush autoplayInViewport />
                  </div>
                ) : null}

                <div className="min-w-0 border-t border-border/25 uix-content-x py-[var(--uix-space-3)]">
                  <FeedPostCaption
                    postId={post.id}
                    text={safeText}
                    expanded={expandedPostIds.has(post.id)}
                    onToggleExpand={() => togglePostExpand(post.id)}
                    onHashtagClick={(tag) => setHashtagFilter(tag)}
                  />

                  <div className="relative mt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
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
                            "inline-flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/25 px-2.5 py-2 text-left transition-transform active:scale-[0.99] sm:flex-none sm:max-w-[min(100%,240px)]",
                            (post.myReaction ?? null) ? "border-primary/40 bg-primary/10" : ""
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                            if (post.myReaction) {
                              reactionMutation.mutate({ postId: post.id, emoji: null });
                            } else {
                              setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
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
                          {topThreeReactionEmojis.length === 0 && !(post.myReaction ?? null) && (
                            <SmilePlus className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
                          )}
                          <span
                            className={cn(
                              "text-[13px] font-semibold tabular-nums",
                              topThreeReactionEmojis.length === 0 && !(post.myReaction ?? null)
                                ? "text-muted-foreground"
                                : "text-foreground/90"
                            )}
                          >
                            {reactionTotal > 0 || (post.myReaction ?? null)
                              ? reactionTotal
                              : "Реакции"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/90 shadow-sm min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] transition-colors",
                            showReactionPicker === post.id ? "border-primary/45 text-primary" : "text-muted-foreground"
                          )}
                          aria-label="Выбрать реакцию"
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
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
                          className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                          title="Комментарии"
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                            setActiveCommentPostId(post.id);
                          }}
                        >
                          <MessageSquare className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/85">{post.commentsCount}</span>
                        </button>
                        <button
                          type="button"
                          className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                          title="Поделиться"
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                            setSharePostId(post.id);
                          }}
                        >
                          <Share2 className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/85">{sharesCount}</span>
                        </button>
                        <span
                          className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground"
                          title="Просмотры"
                        >
                          <Eye className="h-4 w-4 shrink-0 opacity-75" strokeWidth={2} aria-hidden />
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/70">{post.viewsCount ?? 0}</span>
                        </span>
                      </div>
                    </div>

                    {showReactionPicker === post.id && (
                      <div className="absolute bottom-full left-0 z-[60] mb-2 flex w-full max-w-[min(100%,360px)] justify-center sm:justify-start">
                        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                                playLikeActionSound();
                                reactionMutation.mutate({ postId: post.id, emoji });
                                setShowReactionPicker(null);
                              }}
                              className="flex h-10 w-10 items-center justify-center rounded-full text-2xl transition-transform hover:scale-110 active:scale-95"
                              aria-label={`Реакция ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {lastComment ? (
                    <button
                      type="button"
                      onClick={() => setActiveCommentPostId(post.id)}
                      className="mt-3 w-full rounded-xl border border-border/40 bg-secondary/20 px-3 py-2.5 text-left transition-colors hover:bg-secondary/35"
                      aria-label={`Последний комментарий от ${lastComment.user}`}
                    >
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {lastComment.user} · {formatPostTime(lastComment.createdAt)}
                      </span>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-foreground/85">{lastComment.text}</p>
                      {post.commentsCount > 1 && (
                        <span className="mt-1 inline-block text-[11px] text-primary">Все комментарии ({post.commentsCount})</span>
                      )}
                    </button>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-border/45 bg-secondary/12 px-3 py-2.5">
                      <p className="text-[12px] leading-snug text-muted-foreground">
                        Пока без комментариев — напишите первый, пост станет живее
                      </p>
                    </div>
                  )}

                  <FeedInlineCommentRow postId={post.id} />
                </div>
              </article>
                );
                if (isShattering) {
                  return (
                    <MeasuredFeedItem
                      key={post.id}
                      postId={post.id}
                      viewerUserId={user?.id}
                      onHeightChange={updateFeedPostHeight}
                    >
                    <ShatterEffect
                      onComplete={() => {
                        setShatteringPostIds((s) => { const n = new Set(s); n.delete(post.id); return n; });
                        void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
                        toast({ title: "Пост удалён" });
                      }}
                      className="border-b border-border/50"
                      shardClassName="bg-background"
                    >
                      {article}
                    </ShatterEffect>
                    </MeasuredFeedItem>
                  );
                }
                return (
                  <MeasuredFeedItem
                    key={post.id}
                    postId={post.id}
                    viewerUserId={user?.id}
                    onHeightChange={updateFeedPostHeight}
                  >
                    {article}
                  </MeasuredFeedItem>
                );
              })}
              {feedVirtualization.bottomSpacerPx > 0 && (
                <div style={{ height: `${feedVirtualization.bottomSpacerPx}px` }} aria-hidden />
              )}
              </>
            )}
            {isError && feedPosts.length > 0 && (
              <div className="px-4 pb-2">
                <div className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 flex items-center justify-between gap-3">
                  <p className="text-xs text-destructive/90">Не удалось обновить ленту: {feedErrorText}</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="text-xs font-medium text-destructive underline underline-offset-2"
                  >
                    Повторить
                  </button>
                </div>
              </div>
            )}
            {feedPosts.length > 0 && (
              <>
                <div ref={loadMoreRef} className="h-2 flex-shrink-0" aria-hidden />
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Загрузка" />
                  </div>
                )}
              </>
            )}
          </div>
          </FeedScrollRootContext.Provider>
        </PullToRefresh>

        {activeStoryIndex !== null && chainedStoryViewerModel && chainedStoryViewerModel.stories.length > 0 && (
          <StoryViewer
            key={activeStoryIndex}
            stories={chainedStoryViewerModel.stories}
            initialIndex={chainedStoryViewerModel.initialIndex}
            onClose={() => {
              setActiveStoryIndex(null);
              void refetchStories();
            }}
            viewerUserId={user?.id}
            onStoryView={(storyId) => {
              setViewedStoryIds((prev) => {
                const next = new Set(prev);
                next.add(storyId);
                return next;
              });
              const authorId = storyAuthorIdByStoryId.get(storyId);
              if (authorId && authorId !== user?.id) {
                void recordStoryView(storyId);
              }
            }}
            onOpenViewers={(storyId) => setActiveViewersStoryId(storyId)}
            viewersCountByStoryId={(storiesFeed ?? []).reduce<Record<string, number>>((acc, author) => {
              for (const story of author.stories ?? []) acc[story.id] = Number(story.viewsCount ?? 0);
              return acc;
            }, {})}
            onReply={handleStoryReply}
            canReply={!!user}
            onToggleLike={handleStoryLikeToggle}
            canLike={!!user}
            likedByStoryId={likedStoryIds}
            likesCountByStoryId={likesCountByStoryId}
            onShareStory={handleStoryShare}
            onArchiveStory={user ? handleStoryArchive : undefined}
            onDeleteStory={user ? handleStoryDelete : undefined}
          />
        )}

        {activeViewersStoryId && (
          <div
            className="fixed inset-0 z-[380] flex items-end bg-black/50 px-0 pt-3 pb-[max(var(--uix-space-3),calc(env(safe-area-inset-bottom,0px)+var(--uix-space-2)))] backdrop-blur-sm"
            onClick={() => setActiveViewersStoryId(null)}
          >
            <div
              className="mx-auto w-full max-w-[480px] overflow-hidden rounded-t-[28px] border border-white/10 bg-[rgba(10,8,24,0.97)] text-white shadow-2xl backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 pt-1">
                <div className="flex flex-col gap-0.5">
                  <p className="text-base font-extrabold tracking-tight text-white">Кто смотрел</p>
                  <p className="text-xs text-white/45">Список просмотров этой сториз</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveViewersStoryId(null)}
                  className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-white/[0.08] text-white/70 hover:bg-white/[0.12]"
                  aria-label="Закрыть список просмотров"
                >
                  <MoreHorizontal className="h-4 w-4 rotate-90" />
                </button>
              </div>
              <div className="max-h-[52vh] overflow-y-auto px-3 pb-4">
                {activeStoryViewersLoading ? (
                  <div className="px-3 py-4 text-sm text-white/55">Загрузка…</div>
                ) : activeStoryViewers.length === 0 ? (
                  <ListEmptyState
                    icon={Eye}
                    title="Пока нет просмотров"
                    description="Когда пользователи посмотрят сториз, они появятся здесь."
                    className="border-none text-white [&_svg]:text-white/70 [&_p]:text-white/55"
                  />
                ) : (
                  (activeStoryViewers as StoryViewerUser[]).map((viewer) => (
                    <div
                      key={viewer.id}
                      className="flex w-full items-center gap-3 rounded-xl border-b border-white/[0.06] px-2 py-2.5 text-left last:border-b-0 hover:bg-white/[0.06]"
                    >
                      <UserAvatar
                        avatarUrl={viewer.avatarUrl ?? undefined}
                        displayName={[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                        seed={viewer.id}
                        size={36}
                        className="h-9 w-9"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {[viewer.displayName, viewer.surname].filter(Boolean).join(" ") || `ID ${viewer.publicId}`}
                        </p>
                        <p className="text-xs text-white/45">{formatPostTime(viewer.viewedAt)}</p>
                      </div>
                    </div>
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
          postAuthorId={
            activeCommentPostId ? feedPosts.find((p) => p.id === activeCommentPostId)?.authorId : undefined
          }
        />

        <AnimatePresence>
          {sharePostId && (
            <motion.div
              className="fixed inset-0 z-[400] flex items-end bg-black/50 backdrop-blur-sm"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
              onClick={() => !shareToUserMutation.isPending && setSharePostId(null)}
            >
              <motion.div
                className="mx-auto flex max-h-[min(72vh,640px)] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[24px] border border-border/60 bg-background shadow-2xl"
                initial={prefersReducedMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-2 mt-3 h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
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
                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+12px))]">
                  {(() => {
                    const sp = feedPosts.find((p) => p.id === sharePostId);
                    const shareUrl =
                      sp != null
                        ? `${window.location.origin}${buildProfilePostPath({
                            postId: sp.id,
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
                          toast({ title: "Ссылка скопирована" });
                          setSharePostId(null);
                        }
                      } catch (e) {
                        if ((e as Error)?.name === "AbortError") return;
                        toast({ title: "Не удалось поделиться", variant: "destructive" });
                      }
                    };

                    const copyLink = async () => {
                      if (!shareUrl) return;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Ссылка скопирована" });
                        setSharePostId(null);
                      } catch {
                        toast({ title: "Не удалось скопировать", variant: "destructive" });
                      }
                    };

                    if (!sp) {
                      return (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Пост не найден в ленте. Обновите страницу.
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
                          <p className="text-sm text-muted-foreground">Нет контактов — добавьте людей в разделе «Контакты».</p>
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
                                    onClick={() =>
                                      shareToUserMutation.mutate({ postId: sharePostId, toUserId: c.id })
                                    }
                                  >
                                    <UserAvatar
                                      avatarUrl={c.avatarUrl ?? undefined}
                                      displayName={[c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`}
                                      seed={c.id}
                                      size={40}
                                      className="h-10 w-10 rounded-xl"
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
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Avatar long-press menu (Instagram-like bottom sheet) */}
        <AnimatePresence>
          {myAvatarMenu && (
            <motion.div
              className="fixed inset-0 z-[380] flex items-end bg-black/45"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION_NORMAL_S * 0.6 }}
              onClick={() => setMyAvatarMenu(false)}
            >
              <motion.div
                className="mx-auto w-full max-w-[480px] rounded-t-2xl border-t border-border/30 bg-background shadow-2xl px-1 pt-2 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+8px))]"
                initial={prefersReducedMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />

                <button
                  type="button"
                  className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-secondary active:bg-secondary/80"
                  onClick={() => {
                    setMyAvatarMenu(false);
                    triggerStoryFilePicker();
                  }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-primary text-white">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Загрузить сториз</p>
                    <p className="text-xs text-muted-foreground">Фото или видео, исчезает через 24 ч</p>
                  </div>
                </button>

                {isNativePlatform && (
                  <button
                    type="button"
                    className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-secondary active:bg-secondary/80"
                    onClick={() => void triggerStoryCamera()}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-600">
                      <Camera className="h-5 w-5" />
                    </div>
                    <p className="font-semibold">Снять на камеру</p>
                  </button>
                )}

                <button
                  type="button"
                  className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-secondary active:bg-secondary/80"
                  onClick={() => {
                    setMyAvatarMenu(false);
                    setLocation("/profile/me");
                  }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
                    <User className="h-5 w-5" />
                  </div>
                  <p className="font-semibold">Посмотреть аватар</p>
                </button>

                <button
                  type="button"
                  className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-secondary active:bg-secondary/80"
                  onClick={() => {
                    setMyAvatarMenu(false);
                    setLocation("/profile/edit");
                  }}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground">
                    <Pencil className="h-5 w-5" />
                  </div>
                  <p className="font-semibold">Редактировать аватар</p>
                </button>

                <button
                  type="button"
                  className="mt-1 flex w-full min-h-[var(--uix-touch-min)] items-center justify-center rounded-xl px-4 py-3 text-sm text-muted-foreground hover:bg-secondary"
                  onClick={() => setMyAvatarMenu(false)}
                >
                  Отмена
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}