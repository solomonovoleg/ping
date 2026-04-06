import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type ReactNode, type UIEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Share2,
  Plus,
  PenSquare,
  Heart,
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
  Maximize2,
  SmilePlus,
  Copy,
  EyeOff,
  Flag,
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
  recordPostViewBestEffort,
  deletePost,
  sharePostToUser,
  savePost,
  unsavePost,
  updatePost,
  type EdgeDisplayAudience,
  type FeedPost,
  type PostVideoTrimUpload,
  type ReactionUser,
} from "@/lib/posts";
import { DOUBLE_TAP_LIKE_EMOJI } from "@/lib/double-tap-like-reaction";
import { applyReactionOptimistic, updateFeedPostInCache } from "@/lib/feed-query-cache";
import { createComment } from "@/lib/comments";
import { PostMedia } from "@/components/PostMedia";
import { FeedDoubleTapImageLayer } from "@/lib/reels-video";
import { PostExternalVideoEmbed } from "@/components/PostExternalVideoEmbed";
import { PostCaptionInlineParts } from "@/components/PostCaptionInlineParts";
import { extractFirstExternalVideoUrl, isExternalVideoOnlyCaption } from "@/lib/post-external-video";
import { parseExternalVideoUrl } from "@/lib/external-video";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { startDm } from "@/lib/search";
import { sendMessage } from "@/lib/chat";
import { useToast } from "@/hooks/use-toast";
import { resolveUrl } from "@/lib/api-base";
import { edgeCreatorDestructiveToast } from "@/lib/edge-creator";
import {
  archiveStory,
  createStory,
  deleteStory,
  fetchStoriesFeedPage,
  fetchStoryById,
  fetchStoryViewers,
  likeStory,
  recordStoryViewQuiet,
  unlikeStory,
  uploadStoryMedia,
  type StoriesFeedAuthor,
  type StoryViewerUser,
} from "@/lib/stories";
import { compressImage } from "@/lib/compress-image";
import { validateStoryVideoFile } from "@/lib/story-media";
import { getStoryBeautyEnabled, subscribeStoryPrefsChange } from "@/lib/story-prefs";
import { isNative, takePhotoFromCamera, pickPhotoFromGallery, triggerLightHaptic } from "@/lib/capacitor-native";
import { useLongPress } from "@/hooks/useLongPress";
import { useIsMobile } from "@/hooks/use-mobile";
import { PostsFeedSkeleton } from "@/features/posts/posts-feed-skeleton/PostsFeedSkeleton";
import { UploadProgressBlockingOverlay } from "@/components/ui/upload-progress-panel";
import { MotionBottomSheetPanel, MotionBottomSheetScrollArea } from "@/components/ui/motion-bottom-sheet";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle } from "@/components/PageTitle";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ShatterEffect } from "@/components/ShatterEffect";
import { buildProfilePath, buildProfilePostPath, buildReelsPostPath } from "@/lib/profile-route";
import { FeedHeader } from "@/features/feed/components/FeedHeader";
import { useTouchEdgeNavigationEnabled, useTouchRightEdgeSwipeLeft } from "@/hooks/use-touch-edge-swipe";
import { EdgeCompanionFeedCard } from "@/features/edge-companion/components/EdgeCompanionFeedCard";
import { EdgePostAudienceSubmenu } from "@/features/edge-companion/components/EdgePostAudienceSubmenu";
import { buildEdgeCompanionOpenHref } from "@/features/edge-companion/edge-companion-navigation";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { playLikeActionSound } from "@/lib/send-sound";
import { FeedScrollRootContext } from "@/contexts/FeedScrollRootContext";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim";
import { StoryCaptionPublishSheet } from "@/components/story-publish/StoryCaptionPublishSheet";
import { PostLastCommentTeaser, pickNewestCommentPreview } from "@/features/comments/post-comments/PostLastCommentTeaser";
import { FEED_LATEST_COMMENTS_PREVIEW_LIMIT } from "@shared/feed-latest-comments";
import { STORY_VIDEO_MAX_SECONDS } from "@shared/post-video";
import { formatCompactCountRu } from "@/lib/number-format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PULSE_IG_GRAD } from "@/components/story-viewer/constants";
import { ReportContentDialog, type Block01ReportTarget } from "@/features/store-moderation/block-01-ugc";
import {
  feedHiddenPostIdsStorageKey,
  loadHiddenFeedPostIds,
  persistHiddenFeedPostIds,
  withHiddenFeedPostId,
} from "@/lib/feed-hidden-posts";
import {
  collectFeedPostVisualMediaUrls,
  isUploadedVideoMediaUrl,
  postHasUploadedVideo,
} from "@/lib/feed-video-post";

const EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔"];
const FEED_PAGE_SIZE_DEFAULT = 5;
const FEED_PAGE_SIZE_IOS = 3;
const FEED_PAGE_SIZE_SLOW_NETWORK = 2;
const FEED_RENDER_WINDOW_SIZE_DEFAULT = 15;
const FEED_RENDER_WINDOW_SIZE_IOS = 9;
const FEED_RENDER_WINDOW_SIZE_SLOW_NETWORK = 7;
/** Чуть шире видимой зоны — посты и медиа монтируются до скролла до них */
const FEED_RENDER_OVERSCAN_DEFAULT = 5;
const FEED_RENDER_OVERSCAN_IOS = 3;
const FEED_RENDER_OVERSCAN_SLOW_NETWORK = 2;
/** Картинки постов ниже окна виртуализации — прогрев через `Image()` до появления в DOM */
const FEED_MEDIA_PREFETCH_AHEAD_DEFAULT = 10;
const FEED_MEDIA_PREFETCH_AHEAD_IOS = 4;
const FEED_MEDIA_PREFETCH_AHEAD_SLOW_NETWORK = 1;
const FEED_EAGER_MEDIA_WINDOW_DEFAULT = 8;
const FEED_EAGER_MEDIA_WINDOW_IOS = 4;
const FEED_EAGER_MEDIA_WINDOW_SLOW_NETWORK = 2;
const FEED_POST_ESTIMATED_HEIGHT_PX = 560;
/** Пагинация ленты сториз по авторам (сервер: server/stories/service.ts DEFAULT_STORIES_FEED_AUTHOR_LIMIT). */
const STORIES_FEED_AUTHOR_PAGE = 18;

type ShareTarget =
  | { kind: "post"; postId: string }
  | {
      kind: "comment";
      postId: string;
      comment: {
        id: string;
        text: string;
        userName: string;
        userId?: string;
        postPreview?: string;
      };
    }
  | {
      kind: "story";
      story: {
        id: string;
        image: string;
        userName: string;
        time: string;
      };
    };

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
        recordPostViewBestEffort(postId);
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
  onDoubleTapLike,
  linkEmbedEnabled = true,
}: {
  postId: string;
  text: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onHashtagClick: (tag: string) => void;
  /** Лента: двойной тап по тексту — лайк (одиночный тап по ссылкам/хэштегам без изменений). */
  onDoubleTapLike?: () => void;
  /** false — показать ссылку в тексте как обычную, без маски под превью */
  linkEmbedEnabled?: boolean;
}) {
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const [showToggle, setShowToggle] = useState(false);
  const primaryVideoUrl = useMemo(() => {
    if (linkEmbedEnabled === false) return null;
    return extractFirstExternalVideoUrl(text);
  }, [text, linkEmbedEnabled]);
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
  if (linkEmbedEnabled !== false && isExternalVideoOnlyCaption(text, primaryVideoUrl)) return null;

  const captionInner = (
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
  );

  return (
    <div className="min-w-0">
      <div className="min-w-0 rounded-md -mx-0.5 px-0.5">
        {onDoubleTapLike ? (
          <FeedDoubleTapImageLayer className="min-w-0" onDoubleTap={onDoubleTapLike} pulseOnDoubleTap={false}>
            {captionInner}
          </FeedDoubleTapImageLayer>
        ) : (
          captionInner
        )}
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
          ].slice(0, FEED_LATEST_COMMENTS_PREVIEW_LIMIT),
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
  const isMobile = useIsMobile();
  const touchEdgeNavEnabled = useTouchEdgeNavigationEnabled();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [feedReportTarget, setFeedReportTarget] = useState<Block01ReportTarget | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
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
  const [storyUploadPercent, setStoryUploadPercent] = useState<number | null>(null);
  const [doubleTapHeartPostId, setDoubleTapHeartPostId] = useState<string | null>(null);
  const [storyVideoTrimFile, setStoryVideoTrimFile] = useState<File | null>(null);
  const storyVideoTrimConfirmedRef = useRef(false);
  const [storyCaptionPublishMediaUrl, setStoryCaptionPublishMediaUrl] = useState<string | null>(null);
  const [storyPublishSaving, setStoryPublishSaving] = useState(false);
  const [storyCircleBeauty, setStoryCircleBeauty] = useState(getStoryBeautyEnabled);
  const [feedScrollTop, setFeedScrollTop] = useState(0);
  const [feedViewportHeight, setFeedViewportHeight] = useState(() =>
    typeof window !== "undefined" ? Math.max(320, window.innerHeight - 140) : 0,
  );
  const [feedHeightsVersion, setFeedHeightsVersion] = useState(0);
  const storyFileRef = useRef<HTMLInputElement | null>(null);
  const storiesStripRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const doubleTapHeartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const postHeightsRef = useRef<Record<string, number>>({});
  const isLikelyIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent ?? "";
    const platform = navigator.platform ?? "";
    const touchPoints = navigator.maxTouchPoints ?? 0;
    const iosUa = /iPhone|iPad|iPod/i.test(ua);
    // iPadOS 13+ can report Mac platform while remaining touch-first.
    const ipadDesktopUa = platform === "MacIntel" && touchPoints > 1;
    return iosUa || ipadDesktopUa;
  }, []);
  const isSlowNetwork = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    type ConnectionLike = { effectiveType?: string; saveData?: boolean };
    const nav = navigator as Navigator & {
      connection?: ConnectionLike;
      mozConnection?: ConnectionLike;
      webkitConnection?: ConnectionLike;
    };
    const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
    if (!conn) return false;
    if (conn.saveData) return true;
    const effectiveType = (conn.effectiveType ?? "").toLowerCase();
    return effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g";
  }, []);
  const feedPageSize = isSlowNetwork
    ? FEED_PAGE_SIZE_SLOW_NETWORK
    : isLikelyIOS
      ? FEED_PAGE_SIZE_IOS
      : FEED_PAGE_SIZE_DEFAULT;
  const feedRenderWindowSize = isSlowNetwork
    ? FEED_RENDER_WINDOW_SIZE_SLOW_NETWORK
    : isLikelyIOS
      ? FEED_RENDER_WINDOW_SIZE_IOS
      : FEED_RENDER_WINDOW_SIZE_DEFAULT;
  const feedRenderOverscan = isSlowNetwork
    ? FEED_RENDER_OVERSCAN_SLOW_NETWORK
    : isLikelyIOS
      ? FEED_RENDER_OVERSCAN_IOS
      : FEED_RENDER_OVERSCAN_DEFAULT;
  const feedMediaPrefetchAhead = isSlowNetwork
    ? FEED_MEDIA_PREFETCH_AHEAD_SLOW_NETWORK
    : isLikelyIOS
      ? FEED_MEDIA_PREFETCH_AHEAD_IOS
      : FEED_MEDIA_PREFETCH_AHEAD_DEFAULT;
  const feedEagerMediaWindow = isSlowNetwork
    ? FEED_EAGER_MEDIA_WINDOW_SLOW_NETWORK
    : isLikelyIOS
      ? FEED_EAGER_MEDIA_WINDOW_IOS
      : FEED_EAGER_MEDIA_WINDOW_DEFAULT;
  const deepLinkedStoryHandledRef = useRef(false);
  const deepLinkApiAttemptedRef = useRef(false);
  const [deepLinkBoost, setDeepLinkBoost] = useState<StoriesFeedAuthor | null>(null);
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const isNativePlatform = isNative();
  const storyCircleFilter = storyCircleBeauty
    ? "saturate(1.1) contrast(1.08) brightness(1.04) hue-rotate(-2deg)"
    : "none";

  useEffect(() => {
    return subscribeStoryPrefsChange(() => setStoryCircleBeauty(getStoryBeautyEnabled()));
  }, []);

  useEffect(() => {
    return () => {
      if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    };
  }, []);

  const triggerDoubleTapHeart = useCallback((postId: string) => {
    if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    setDoubleTapHeartPostId(postId);
    doubleTapHeartTimerRef.current = setTimeout(() => {
      setDoubleTapHeartPostId((cur) => (cur === postId ? null : cur));
      doubleTapHeartTimerRef.current = null;
    }, 460);
  }, []);

  const openFeedReelsForPost = useCallback(
    (post: FeedPost) => {
      const base = buildReelsPostPath({
        postId: post.id,
        linkCode: post.linkCode,
        isMe: post.authorId === user?.id,
        publicId: post.author?.publicId,
        userId: post.authorId,
      });
      if (!hashtagFilter) {
        setLocation(base);
        return;
      }
      if (base.startsWith("/reels?")) {
        const p = new URLSearchParams(base.slice("/reels".length) || "?");
        p.set("tag", hashtagFilter);
        setLocation(`/reels?${p.toString()}`);
        return;
      }
      setLocation(`${base}?tag=${encodeURIComponent(hashtagFilter)}`);
    },
    [hashtagFilter, setLocation, user?.id],
  );

  const togglePostExpand = (postId: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const feedOpts = useMemo(
    () => (hashtagFilter ? { hashtag: hashtagFilter } : undefined),
    [hashtagFilter],
  );
  const feedQueryKey = useMemo(
    () => ["posts", "feed", hashtagFilter ?? "", feedPageSize] as const,
    [hashtagFilter, feedPageSize],
  );
  const getNextFeedPageParam = useCallback((lastPage: FeedPost[], allPages: FeedPost[][]) => {
    if (!Array.isArray(lastPage)) return undefined;
    return lastPage.length < feedPageSize ? undefined : allPages.length * feedPageSize;
  }, [feedPageSize]);

  const {
    data: feedData,
    isLoading,
    isFetching,
    isError,
    error: feedError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: feedQueryKey,
    queryFn: ({ pageParam }) => fetchFeed(feedPageSize, pageParam as number, feedOpts),
    initialPageParam: 0,
    getNextPageParam: getNextFeedPageParam,
  });

  /** При возврате на ленту подтягиваем первую страницу (новые посты), без N запросов за все уже подгруженные страницы. */
  useEffect(() => {
    if (queryClient.getQueryData(feedQueryKey) === undefined) return;
    void queryClient.fetchInfiniteQuery({
      queryKey: feedQueryKey,
      queryFn: ({ pageParam }) => fetchFeed(feedPageSize, pageParam as number, feedOpts),
      initialPageParam: 0,
      getNextPageParam: getNextFeedPageParam,
      pages: 1,
      staleTime: 0,
    });
  }, [queryClient, feedQueryKey, feedOpts, getNextFeedPageParam, feedPageSize]);
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
        linkCode: post.linkCode,
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

  useLayoutEffect(() => {
    const el = feedScrollRef.current;
    if (!el) return;
    const h = el.clientHeight || Math.round(el.getBoundingClientRect().height);
    if (h > 0) setFeedViewportHeight(h);
    setFeedScrollTop(el.scrollTop);
  }, []);

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
    const visibleStart = Math.max(0, findPostIndexByOffset(offsets, totalItems, viewportTop) - feedRenderOverscan);
    const visibleEnd = Math.min(
      totalItems,
      findPostIndexByOffset(offsets, totalItems, viewportBottom) + 1 + feedRenderOverscan,
    );

    let startIndex = visibleStart;
    let endIndexExclusive = visibleEnd;
    if (endIndexExclusive - startIndex > feedRenderWindowSize) {
      startIndex = Math.max(0, endIndexExclusive - feedRenderWindowSize);
    }
    if (endIndexExclusive - startIndex < feedRenderWindowSize) {
      endIndexExclusive = Math.min(totalItems, startIndex + feedRenderWindowSize);
    }

    const topSpacerPx = offsets[startIndex] ?? 0;
    const bottomSpacerPx = Math.max(0, (offsets[totalItems] ?? 0) - (offsets[endIndexExclusive] ?? 0));
    return { startIndex, endIndexExclusive, topSpacerPx, bottomSpacerPx };
  }, [
    visibleFeedPosts,
    feedScrollTop,
    feedViewportHeight,
    feedHeightsVersion,
    feedRenderOverscan,
    feedRenderWindowSize,
  ]);

  const feedEndExclusive = feedVirtualization.endIndexExclusive;
  useEffect(() => {
    if (!Array.isArray(feedData?.pages)) return;
    const posts = feedData.pages.flat() as FeedPost[];
    const start = feedEndExclusive;
    const end = Math.min(posts.length, start + feedMediaPrefetchAhead);
    if (start >= end) return;
    const seen = new Set<string>();
    for (let i = start; i < end; i++) {
      const post = posts[i];
      if (!post) continue;
      for (const u of collectFeedPostVisualMediaUrls(post)) {
        if (isUploadedVideoMediaUrl(u)) continue;
        const abs = resolveUrl(u);
        if (seen.has(abs)) continue;
        seen.add(abs);
        const img = new Image();
        img.decoding = "async";
        img.src = abs;
      }
    }
  }, [feedData?.pages, feedEndExclusive, feedMediaPrefetchAhead]);

  const renderedFeedPosts = visibleFeedPosts.slice(
    feedVirtualization.startIndex,
    feedVirtualization.endIndexExclusive,
  );
  const eagerMediaEndExclusive = Math.min(
    visibleFeedPosts.length,
    feedVirtualization.startIndex + feedEagerMediaWindow,
  );
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
      {
        rootMargin: isSlowNetwork
          ? "220px 0px 220px 0px"
          : isLikelyIOS
            ? "300px 0px 300px 0px"
            : "520px 0px 520px 0px",
        threshold: 0.1,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isLikelyIOS, isSlowNetwork]);

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
    enabled: shareTarget !== null,
  });

  const {
    data: storiesPagesData,
    isLoading: storiesLoading,
    isError: storiesError,
    error: storiesFeedError,
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
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
      return 60_000;
    },
  });

  const storiesFeedErrorMessage =
    storiesFeedError instanceof Error ? storiesFeedError.message : "Не удалось загрузить сториз";

  const storiesFeedFromQuery = useMemo(() => {
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

  /** Лента с сервера + временная вставка автора при открытии по диплинку `?storyId=`. */
  const storiesFeed = useMemo(() => {
    if (!deepLinkBoost) return storiesFeedFromQuery;
    const sid = deepLinkBoost.stories[0]?.id;
    if (
      sid &&
      storiesFeedFromQuery.some((a) => (a.stories ?? []).some((s) => String(s.id) === String(sid)))
    ) {
      return storiesFeedFromQuery;
    }
    if (storiesFeedFromQuery.some((a) => a.authorId === deepLinkBoost.authorId)) {
      return storiesFeedFromQuery;
    }
    return [...storiesFeedFromQuery, deepLinkBoost];
  }, [storiesFeedFromQuery, deepLinkBoost]);

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

  const {
    data: activeStoryViewers = [],
    isLoading: activeStoryViewersLoading,
    isError: activeStoryViewersError,
    error: activeStoryViewersErrorRaw,
    refetch: refetchStoryViewers,
  } = useQuery({
    queryKey: ["stories", "viewers", activeViewersStoryId],
    queryFn: () => fetchStoryViewers(activeViewersStoryId!),
    enabled: !!activeViewersStoryId,
  });

  const activeStoryViewersErrorMessage =
    activeStoryViewersErrorRaw instanceof Error
      ? activeStoryViewersErrorRaw.message
      : "Не удалось загрузить список просмотров";

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
    mutationFn: async ({ target, toUserId }: { target: ShareTarget; toUserId: string }) => {
      if (target.kind === "post") {
        return sharePostToUser(target.postId, toUserId);
      }
      if (target.kind === "comment") {
        const chat = await startDm(toUserId);
        await sendMessage(chat.id, {
          type: "comment_share",
          content: JSON.stringify({
            postId: target.postId,
            commentId: target.comment.id,
            text: target.comment.text,
            authorName: target.comment.userName,
            authorId: target.comment.userId ?? "",
            postPreview: target.comment.postPreview ?? "",
          }),
        });
        return { chatId: chat.id };
      }
      const chat = await startDm(toUserId);
      await sendMessage(chat.id, {
        type: "story_reply",
        content: JSON.stringify({
          storyId: target.story.id,
          mediaUrl: target.story.image,
          authorName: target.story.userName,
          storyTimeLabel: target.story.time,
        }),
      });
      return { chatId: chat.id };
    },
    onSuccess: (data, vars) => {
      setShareTarget(null);
      const title =
        vars.target.kind === "post"
          ? "Пост отправлен в чат"
          : vars.target.kind === "comment"
            ? "Комментарий отправлен в чат"
            : "Сториз отправлена в чат";
      toast({ title });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["stories", "feed"] });
      setLocation(`/chat/${encodeURIComponent(data.chatId)}`);
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" }),
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

  const edgeAudienceMutation = useMutation({
    mutationFn: ({ postId, edgeDisplayAudience }: { postId: string; edgeDisplayAudience: EdgeDisplayAudience }) =>
      updatePost(postId, { edgeDisplayAudience }),
    onMutate: async ({ postId, edgeDisplayAudience }) => {
      await queryClient.cancelQueries({ queryKey: ["posts", "feed"] });
      const previous = queryClient.getQueriesData({ queryKey: ["posts", "feed"] });
      updateFeedPostInCache(queryClient, postId, (p) => ({ ...p, edgeDisplayAudience }));
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      ctx?.previous?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      const t = edgeCreatorDestructiveToast(e);
      toast({ title: t.title, description: t.description, variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
    },
    onSuccess: () => {
      toast({ title: "Кому виден EDGE обновлено" });
    },
  });

  const currentUserName = user ? [user.displayName, user.surname].filter(Boolean).join(" ") || "Профиль" : "Профиль";

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
            circleAvatarUrl: author.avatarUrl ?? null,
            circleAvatarSeed: String(author.id ?? a.authorId),
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
            circleAvatarUrl: user?.avatarUrl ?? null,
            circleAvatarSeed: user?.id ?? "me",
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
        {
          id: "me",
          name: "Моя история",
          circleAvatarUrl: user?.avatarUrl ?? null,
          circleAvatarSeed: user?.id ?? "me",
          isMe: true,
          hasActive: false,
          hasUnseen: false,
          image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=1200&fit=crop",
          time: "",
          stories: [],
          author: null,
        },
      ];

  useEffect(() => {
    if (deepLinkedStoryHandledRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const deepLinkedStoryId = params.get("storyId")?.trim() ?? "";
    if (!deepLinkedStoryId) {
      deepLinkedStoryHandledRef.current = true;
      return;
    }
    if (!user) return;
    if (!storyCircles.length) return;
    const idx = storyCircles.findIndex((item) =>
      Array.isArray(item.stories) && item.stories.some((s) => String(s.id) === deepLinkedStoryId)
    );
    if (idx < 0) {
      if (storiesHasNextPage && !storiesFetchingNextPage) {
        void fetchNextStoriesPage();
        return;
      }
      if (storiesLoading || storiesFetchingNextPage) return;
      if (!deepLinkApiAttemptedRef.current) {
        deepLinkApiAttemptedRef.current = true;
        void fetchStoryById(deepLinkedStoryId)
          .then((item) => {
            const author = item.author;
            setDeepLinkBoost({
              authorId: item.authorId,
              author: author ?? { id: item.authorId, publicId: 0, displayName: null, avatarUrl: null },
              stories: [item],
              hasUnseen: true,
              unseenCount: 1,
              latestStoryAt: item.createdAt,
            });
          })
          .catch(() => {
            deepLinkedStoryHandledRef.current = true;
            toast({
              title: "Сториз недоступна",
              description: "Возможно, она уже исчезла, удалена или скрыта настройками приватности.",
            });
            const p = new URLSearchParams(window.location.search);
            p.delete("storyId");
            p.delete("storyAuthorId");
            const qMiss = p.toString();
            setLocation(`${window.location.pathname}${qMiss ? `?${qMiss}` : ""}`, {
              replace: true,
            } as { replace?: boolean });
          });
        return;
      }
      return;
    }
    deepLinkedStoryHandledRef.current = true;
    setActiveStoryIndex(idx);
    params.delete("storyId");
    params.delete("storyAuthorId");
    const q = params.toString();
    setLocation(`${window.location.pathname}${q ? `?${q}` : ""}`, {
      replace: true,
    } as { replace?: boolean });
  }, [
    fetchNextStoriesPage,
    setLocation,
    storyCircles,
    storiesFetchingNextPage,
    storiesHasNextPage,
    storiesLoading,
    toast,
    user,
  ]);

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
      const circleAv = (item as { circleAvatarUrl?: string | null }).circleAvatarUrl;
      return [
        {
          id: storyId,
          authorId: authorIdFromCircle,
          image: (item as { image?: string })?.image ?? "",
          userName: (item as { name?: string })?.name ?? "",
          userAvatar: circleAv?.trim() ? circleAv : "",
          time: (item as { time?: string })?.time ?? "",
        },
      ];
    }
    const author = (item as { author?: { id?: string; displayName: string | null; avatarUrl: string | null; publicId: number } }).author;
    const name = author?.displayName || (item as { name?: string }).name || `ID ${author?.publicId ?? ""}`;
    const slideAvatarUrl =
      author?.avatarUrl?.trim() ||
      (item as { circleAvatarUrl?: string | null }).circleAvatarUrl?.trim() ||
      "";
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
      const rawCap = (s as { caption?: unknown }).caption;
      const cap = typeof rawCap === "string" ? rawCap.trim() : "";
      return {
        id: s.id,
        image: resolveUrl(s.mediaUrl),
        ...(thumb ? { thumbnailUrl: resolveUrl(thumb) } : {}),
        userName: name,
        userAvatar: slideAvatarUrl,
        time: formatPostTime(s.createdAt),
        authorId: slideAuthorId || undefined,
        expiresAt: s.expiresAt,
        likesCount: Number(s.likesCount ?? 0),
        isLiked: s.isLiked === true,
        ...(cap ? { caption: cap } : {}),
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
    setShareTarget({ kind: "story", story });
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

  const handleStoryTrimmerOpenChange = useCallback((open: boolean) => {
    if (!open) {
      if (storyVideoTrimConfirmedRef.current) {
        storyVideoTrimConfirmedRef.current = false;
        return;
      }
      setStoryVideoTrimFile(null);
    }
  }, []);

  const handleStoryVideoTrimConfirm = useCallback(
    async (trim: PostVideoTrimUpload) => {
      const file = storyVideoTrimFile;
      if (!file || storyUploading) return;
      storyVideoTrimConfirmedRef.current = true;
      setStoryVideoTrimFile(null);
      setStoryUploading(true);
      setStoryUploadPercent(0);
      try {
        const mediaUrl = await uploadStoryMedia(file, trim, {
          onProgress: (p) => setStoryUploadPercent(p),
        });
        setStoryUploadPercent(null);
        setStoryCaptionPublishMediaUrl(mediaUrl);
      } catch (err) {
        toast({ title: err instanceof Error ? err.message : "Ошибка загрузки сториз", variant: "destructive" });
      } finally {
        setStoryUploading(false);
        setStoryUploadPercent(null);
      }
    },
    [storyVideoTrimFile, storyUploading, toast],
  );

  const handleStoryFileUpload = async (file: File) => {
    if (storyUploading) return;
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      const videoValidationError = validateStoryVideoFile(file);
      if (videoValidationError) {
        toast({ title: videoValidationError, variant: "destructive" });
        return;
      }
      setStoryVideoTrimFile(file);
      return;
    }
    setStoryUploading(true);
    setStoryUploadPercent(0);
    try {
      const toUpload = await compressImage(file);
      const mediaUrl = await uploadStoryMedia(toUpload, undefined, {
        onProgress: (p) => setStoryUploadPercent(p),
      });
      setStoryUploadPercent(null);
      setStoryCaptionPublishMediaUrl(mediaUrl);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Ошибка загрузки сториз", variant: "destructive" });
    } finally {
      setStoryUploading(false);
      setStoryUploadPercent(null);
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
      // Тот же сценарий, что и по «+»: только нижний шит; системный picker — из пункта «Загрузить сториз».
      setMyAvatarMenu(true);
    }
  };

  const goToReelsFromFeed = useCallback(() => {
    void triggerLightHaptic();
    if (hashtagFilter) {
      setLocation(`/reels?tag=${encodeURIComponent(hashtagFilter)}`);
    } else {
      setLocation("/reels");
    }
  }, [hashtagFilter, setLocation]);

  const feedSwipeEdgeNavBlocked = useMemo(
    () =>
      activeStoryIndex !== null ||
      activeCommentPostId !== null ||
      showReactionPicker !== null ||
      shareTarget !== null ||
      myAvatarMenu ||
      storyVideoTrimFile !== null ||
      storyCaptionPublishMediaUrl !== null ||
      storyUploading ||
      activeViewersStoryId !== null,
    [
      activeStoryIndex,
      activeCommentPostId,
      showReactionPicker,
      shareTarget,
      myAvatarMenu,
      storyVideoTrimFile,
      storyCaptionPublishMediaUrl,
      storyUploading,
      activeViewersStoryId,
    ],
  );

  useTouchRightEdgeSwipeLeft({
    enabled: touchEdgeNavEnabled,
    blocked: feedSwipeEdgeNavBlocked,
    onNavigate: goToReelsFromFeed,
  });

  return (
    <div
      className="flex flex-1 min-h-0 h-full w-full max-w-full min-w-0 flex-col overflow-x-hidden bg-background"
      data-pull-refresh-scope
    >
      <PageTitle title="Лента" />
      <div
        role="main"
        aria-label="Лента постов"
        className="flex w-full max-w-full min-w-0 flex-1 min-h-0 flex-col bg-background"
      >
        
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
          disabled={!!storyVideoTrimFile}
        >
          <FeedScrollRootContext.Provider value={feedScrollRef}>
          {/* Stories Section */}
          <div className="py-4 bg-background">
            {storiesError && user && storyCircles.length > 0 ? (
              <div className="uix-content-x mb-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 flex items-center justify-between gap-3">
                <p className="text-xs text-destructive/90 min-w-0 flex-1">
                  Сторис: не удалось обновить ({storiesFeedErrorMessage})
                </p>
                <button
                  type="button"
                  onClick={() => void refetchStories()}
                  className="shrink-0 text-xs font-medium text-destructive underline underline-offset-2 min-h-[var(--uix-touch-min)] px-1"
                >
                  Повторить
                </button>
              </div>
            ) : null}
            <div
              ref={storiesStripRef}
              data-app-tab-swipe-exclude
              onScroll={onStoriesStripScroll}
              className="flex gap-4 overflow-x-auto hide-scrollbar uix-content-x items-center"
            >
              {storiesError && storyCircles.length === 0 && user && (
                <div className="flex flex-col gap-2 flex-shrink-0 min-w-[200px]">
                  <p className="text-xs text-destructive/90 px-1">Сторис не загрузились</p>
                  <button
                    type="button"
                    onClick={() => void refetchStories()}
                    className="px-3 py-2 rounded-xl bg-secondary text-sm font-medium text-muted-foreground hover:text-foreground min-h-[var(--uix-touch-min)]"
                  >
                    Повторить
                  </button>
                </div>
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
                    <div
                      className={cn(
                        "h-16 w-16 rounded-full p-[2px] transition-transform duration-200 group-active:scale-95",
                        isMe && storyUploading && "animate-pulse",
                        (story as { hasUnseen?: boolean }).hasUnseen && "shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                      )}
                      style={{
                        background:
                          (story as { hasUnseen?: boolean }).hasUnseen
                            ? PULSE_IG_GRAD
                            : (story as { hasActive?: boolean }).hasActive
                              ? "linear-gradient(145deg, rgba(129,140,248,0.92), rgba(217,70,239,0.78), rgba(99,102,241,0.72))"
                              : "hsl(var(--border))",
                      }}
                    >
                      <div
                        style={{ filter: storyCircleFilter }}
                        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-background bg-background"
                      >
                        <UserAvatar
                          avatarUrl={(story as { circleAvatarUrl?: string | null }).circleAvatarUrl ?? undefined}
                          displayName={(story as { name?: string }).name}
                          seed={(story as { circleAvatarSeed?: string }).circleAvatarSeed ?? String(story.id)}
                          size={60}
                          className="rounded-full"
                          pointerEventsNone
                        />
                      </div>
                    </div>
                    {isMe && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onPointerUp={(e) => e.stopPropagation()}
                        onPointerCancel={(e) => e.stopPropagation()}
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
                    {"isTrending" in story && Boolean((story as { isTrending?: unknown }).isTrending) ? (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm border-[1.5px] border-background px-1.5 py-0.5 rounded-md flex items-center gap-0.5 z-10 animate-[pulse_2s_ease-in-out_infinite]">
                        <span className="text-[9px] font-bold tracking-wide uppercase leading-none">HOT</span>
                      </div>
                    ) : null}
                    {(() => {
                      const raw = (story as { views?: unknown }).views;
                      if (raw === undefined || raw === null) return null;
                      return (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground shadow-sm border border-background px-1.5 py-0.5 rounded-full flex items-center gap-1 z-10">
                          <Eye className="w-3 h-3 opacity-70" />
                          <span className="text-[10px] font-semibold leading-none">{String(raw)}</span>
                        </div>
                      );
                    })()}
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
                <div className="flex flex-shrink-0 items-center gap-3 pr-1" aria-busy="true" aria-label="Загрузка сториз">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="flex flex-col items-center gap-1.5">
                      <Skeleton className="h-16 w-16 shrink-0 rounded-full" />
                      <Skeleton className="h-2.5 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
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
            <div className="uix-content-x-tight py-2 flex items-center gap-2 bg-secondary/20">
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
          <div className="flex flex-col gap-2 min-h-[40vh]">
            {feedPosts.length === 0 && (isLoading || isFetching) && !isError ? (
              <PostsFeedSkeleton count={4} />
            ) : isError && feedPosts.length === 0 ? (
              <ErrorWithRetry
                title="Не удалось загрузить ленту"
                description={feedErrorText}
                onRetry={() => refetch()}
              />
            ) : feedPosts.length === 0 ? (
              <div className="flex flex-col gap-2">
                {isFetching && !isLoading ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 py-2.5 px-3 text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                      aria-hidden
                    />
                    Обновляем ленту…
                  </div>
                ) : null}
                <ListEmptyState
                  icon={PenSquare}
                  title="Пока нет постов"
                  description="Создайте пост — он появится здесь. Обновите ленту: потяните экран вниз или нажмите «Обновить ленту» (если на сервере уже есть тестовые посты)."
                  actionLabel="Написать первый пост"
                  onAction={() => setLocation("/create-post")}
                  secondaryActionLabel="Обновить ленту"
                  onSecondaryAction={() => void refetch()}
                />
              </div>
            ) : visibleFeedPosts.length === 0 ? (
              <div className="flex flex-col gap-2">
                {isFetching && !isLoading ? (
                  <div
                    className="flex items-center justify-center gap-2 rounded-xl bg-muted/40 py-2.5 px-3 text-xs text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
                      aria-hidden
                    />
                    Обновляем ленту…
                  </div>
                ) : null}
                <ListEmptyState
                  icon={EyeOff}
                  title="Посты скрыты"
                  description="Вы скрыли все видимые посты на этом устройстве. Новые посты появятся в ленте как обычно."
                  actionLabel="Показать скрытые снова"
                  onAction={clearHiddenFeedPosts}
                  secondaryActionLabel="Обновить ленту"
                  onSecondaryAction={() => void refetch()}
                />
              </div>
            ) : (
              <>
              {feedVirtualization.topSpacerPx > 0 && (
                <div style={{ height: `${feedVirtualization.topSpacerPx}px` }} aria-hidden />
              )}
              {renderedFeedPosts.map((post: FeedPost, localIdx) => {
                const absoluteIndex = feedVirtualization.startIndex + localIdx;
                const eagerMedia = absoluteIndex < eagerMediaEndExclusive;
                const isShattering = shatteringPostIds.has(post.id);
                const safeText = post.text ?? "";
                const viewerId = user?.id != null ? String(user.id) : "";
                const postAuthorId = post.authorId != null ? String(post.authorId) : "";
                const isOwnPost = viewerId.length > 0 && postAuthorId === viewerId;
                const authorProfilePath = buildProfilePath({
                  isMe: isOwnPost,
                  publicId: post.author?.publicId,
                  userId: post.authorId,
                  fallbackPath: "/posts",
                });
                const postDetailPath = buildProfilePostPath({
                  postId: post.id,
                  linkCode: post.linkCode,
                  isMe: isOwnPost,
                  publicId: post.author?.publicId,
                  userId: post.authorId,
                  fallbackPath: "/posts",
                });
                const lastComment = pickNewestCommentPreview(post.latestComments);
                const reactionTotal =
                  post.reactions?.reduce((sum: number, r: { count: number }) => sum + r.count, 0) ?? 0;
                const topThreeReactionEmojis = [...(post.reactions ?? [])]
                  .filter((r) => r.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((r) => r.emoji);
                const sharesCount = post.sharesCount ?? 0;
                const mediaList = post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : [];
                const postHasVideo = postHasUploadedVideo(post);
                const feedVideoSoundOn = feedSoundPostId === post.id;
                const linkEmbedOn = post.linkEmbedEnabled !== false;
                const primaryExternalVideoUrl = linkEmbedOn ? extractFirstExternalVideoUrl(safeText) : null;
                const article = (
              <article className="overflow-x-hidden bg-background transition-colors duration-200 ease-out">
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
                      pointerEventsNone
                    />
                    <div className="flex min-h-[42px] min-w-0 flex-1 flex-col justify-center">
                      <h3
                        className="min-h-[18px] truncate text-[15px] font-semibold leading-[1.2] transition-colors group-hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(postDetailPath);
                        }}
                      >
                        {post.channelName || (post.author ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ") : null) || `ID ${post.author?.publicId ?? post.authorId}`}
                      </h3>
                      <p
                        className="mt-[var(--uix-space-1)] min-h-[16px] cursor-pointer text-[12px] leading-4 text-muted-foreground hover:text-foreground"
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
                        className="flex h-9 w-9 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-xl bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
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
                        <DropdownMenuContent
                          align="end"
                          sideOffset={6}
                          className="w-52"
                          onCloseAutoFocus={(e) => e.preventDefault()}
                        >
                          <DropdownMenuItem
                            className="min-h-[var(--uix-touch-min)]"
                            onClick={() => copyFeedPostLink(post)}
                          >
                            <Copy className="h-4 w-4" />
                            Скопировать ссылку
                          </DropdownMenuItem>
                          {user && !isOwnPost ? (
                            <DropdownMenuItem
                              className="min-h-[var(--uix-touch-min)]"
                              onClick={() => hidePostFromFeed(post.id)}
                            >
                              <EyeOff className="h-4 w-4" />
                              Скрыть из ленты
                            </DropdownMenuItem>
                          ) : null}
                          {user && !isOwnPost ? (
                            <DropdownMenuItem
                              className="min-h-[var(--uix-touch-min)]"
                              onSelect={() => {
                                requestAnimationFrame(() =>
                                  setFeedReportTarget({ targetType: "post", targetId: post.id }),
                                );
                              }}
                            >
                              <Flag className="h-4 w-4" />
                              Пожаловаться
                            </DropdownMenuItem>
                          ) : null}
                          {isOwnPost ? (
                            <>
                              <DropdownMenuSeparator />
                              {post.edgeId ? (
                                <EdgePostAudienceSubmenu
                                  current={post.edgeDisplayAudience}
                                  disabled={
                                    edgeAudienceMutation.isPending && edgeAudienceMutation.variables?.postId === post.id
                                  }
                                  onPick={(edgeDisplayAudience) => {
                                    void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                                      triggerLightHaptic(),
                                    );
                                    edgeAudienceMutation.mutate({ postId: post.id, edgeDisplayAudience });
                                  }}
                                />
                              ) : null}
                              <DropdownMenuItem
                                className="min-h-[var(--uix-touch-min)]"
                                onClick={() => {
                                  setLocation(`/create-post?edit=${encodeURIComponent(post.id)}`);
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

                {mediaList.length > 0 && (
                  <div className="relative w-full">
                    <PostMedia
                      mediaUrls={mediaList}
                      layout={post.mediaLayout ?? null}
                      edgeToEdge
                      feedEagerImages={eagerMedia}
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
                                triggerDoubleTapHeart(post.id);
                                const mine = post.myReaction;
                                reactionMutation.mutate({
                                  postId: post.id,
                                  emoji: mine === DOUBLE_TAP_LIKE_EMOJI ? null : DOUBLE_TAP_LIKE_EMOJI,
                                });
                              },
                            }
                          : null
                      }
                      feedReelsDeferredOpen={
                        user && postHasVideo ? () => openFeedReelsForPost(post) : undefined
                      }
                    />
                    <AnimatePresence>
                      {doubleTapHeartPostId === post.id ? (
                        <motion.div
                          key={`double-tap-heart-${post.id}`}
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
                    {user ? (
                      <div className="absolute right-[max(0.5rem,env(safe-area-inset-right))] top-2 z-10 flex items-center gap-1.5">
                        {postHasVideo ? (
                          <>
                            <button
                              type="button"
                              className="flex h-8 w-8 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform active:scale-90"
                              aria-label="Открыть в iSee"
                              onClick={(e) => {
                                e.stopPropagation();
                                void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                                  triggerLightHaptic(),
                                );
                                openFeedReelsForPost(post);
                              }}
                            >
                              <Maximize2 className="h-4 w-4 opacity-95" strokeWidth={2.25} aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="flex h-8 w-8 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform active:scale-90"
                              aria-label={feedVideoSoundOn ? "Выключить звук видео" : "Включить звук видео"}
                              onClick={(e) => {
                                e.stopPropagation();
                                void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                                const turningOff = feedSoundPostId === post.id;
                                if (!turningOff) {
                                  const article = (e.currentTarget as HTMLElement).closest("article");
                                  const vid = article?.querySelector("video");
                                  if (vid) {
                                    vid.muted = false;
                                    vid.volume = 1;
                                    void vid.play().catch(() => {});
                                  }
                                } else {
                                  const article = (e.currentTarget as HTMLElement).closest("article");
                                  const vid = article?.querySelector("video");
                                  if (vid) vid.muted = true;
                                }
                                setFeedSoundPostId((cur) => (cur === post.id ? null : post.id));
                              }}
                            >
                              {feedVideoSoundOn ? (
                                <Volume2 className="h-4 w-4 opacity-95" strokeWidth={2.25} aria-hidden />
                              ) : (
                                <VolumeX className="h-4 w-4 opacity-90" strokeWidth={2.25} aria-hidden />
                              )}
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          className="flex h-8 w-8 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform active:scale-90"
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

                {primaryExternalVideoUrl ? (
                  <div className="relative w-full">
                    <PostExternalVideoEmbed url={primaryExternalVideoUrl} flush autoplayInViewport />
                  </div>
                ) : null}

                <div className="min-w-0 uix-content-x py-[var(--uix-space-3)]">
                  <FeedPostCaption
                    postId={post.id}
                    text={safeText}
                    linkEmbedEnabled={linkEmbedOn}
                    expanded={expandedPostIds.has(post.id)}
                    onToggleExpand={() => togglePostExpand(post.id)}
                    onHashtagClick={(tag) => setHashtagFilter(tag)}
                    onDoubleTapLike={
                      user
                        ? () => {
                            void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                              triggerLightHaptic(),
                            );
                            playLikeActionSound();
                            triggerDoubleTapHeart(post.id);
                            const mine = post.myReaction;
                            reactionMutation.mutate({
                              postId: post.id,
                              emoji: mine === DOUBLE_TAP_LIKE_EMOJI ? null : DOUBLE_TAP_LIKE_EMOJI,
                            });
                          }
                        : undefined
                    }
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
                            "inline-flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-xl bg-secondary/25 px-2.5 py-2 text-left transition-transform active:scale-[0.99] sm:flex-none sm:max-w-[min(100%,240px)]",
                            (post.myReaction ?? null) ? "bg-primary/10" : ""
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
                              ? formatCompactCountRu(reactionTotal)
                              : "Реакции"}
                          </span>
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/30 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] transition-colors hover:bg-secondary/50",
                            showReactionPicker === post.id ? "text-primary bg-primary/10" : "text-muted-foreground"
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
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/85">
                            {formatCompactCountRu(post.commentsCount)}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground active:scale-[0.98]"
                          title="Поделиться"
                          onClick={(e) => {
                            e.stopPropagation();
                            import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                            setShareTarget({ kind: "post", postId: post.id });
                          }}
                        >
                          <Share2 className="h-4 w-4 shrink-0 opacity-85" strokeWidth={2} aria-hidden />
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/85">
                            {formatCompactCountRu(sharesCount)}
                          </span>
                        </button>
                        <span
                          className="flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-lg px-1.5 py-1 text-muted-foreground"
                          title="Просмотры"
                        >
                          <Eye className="h-4 w-4 shrink-0 opacity-75" strokeWidth={2} aria-hidden />
                          <span className="text-[12px] font-semibold tabular-nums text-foreground/70">
                            {formatCompactCountRu(post.viewsCount ?? 0)}
                          </span>
                        </span>
                      </div>
                    </div>

                    {showReactionPicker === post.id && (
                      <div className="absolute bottom-full left-0 z-[60] mb-2 flex w-full max-w-[min(100%,360px)] justify-center sm:justify-start">
                        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-background/95 px-3 py-2 shadow-lg backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
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
                    <PostLastCommentTeaser
                      comment={lastComment}
                      commentsCount={post.commentsCount}
                      onOpen={() => setActiveCommentPostId(post.id)}
                      ariaLabel={
                        post.commentsCount > 1
                          ? `Комментарии: последний от ${lastComment.user}, есть ещё`
                          : `Комментарии: ${lastComment.user}`
                      }
                      className="mt-2"
                    />
                  ) : post.commentsCount === 0 ? (
                    <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
                      Пока без комментариев — напишите первый.
                    </p>
                  ) : null}

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
                      className=""
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
            sessionResumeKey={activeStoryIndex !== null ? `feed-ring-${activeStoryIndex}` : undefined}
            onClose={() => {
              setActiveStoryIndex(null);
              setDeepLinkBoost(null);
              deepLinkApiAttemptedRef.current = false;
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
                void recordStoryViewQuiet(storyId);
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
              className="w-full uix-responsive-max-w overflow-hidden rounded-t-[28px] border border-white/10 bg-[rgba(10,8,24,0.97)] text-white shadow-2xl backdrop-blur-xl"
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
                {activeStoryViewersError ? (
                  <div className="flex flex-col items-center gap-3 px-3 py-8 text-center">
                    <p className="text-sm text-rose-200/90">{activeStoryViewersErrorMessage}</p>
                    <button
                      type="button"
                      onClick={() => void refetchStoryViewers()}
                      className="min-h-[var(--uix-touch-min)] rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white hover:bg-white/16"
                    >
                      Повторить
                    </button>
                  </div>
                ) : activeStoryViewersLoading ? (
                  <div className="space-y-3 px-3 py-4" aria-busy="true" aria-label="Загрузка списка просмотров">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/10" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <Skeleton className="h-3.5 w-[42%] rounded bg-white/10" />
                          <Skeleton className="h-3 w-[28%] rounded bg-white/10" />
                        </div>
                      </div>
                    ))}
                  </div>
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
          onShareCommentToChat={(comment) => {
            const postId = comment.postId || activeCommentPostId;
            if (!postId) return;
            const postPreview = feedPosts.find((p) => p.id === postId)?.text?.slice(0, 140) ?? "";
            setShareTarget({
              kind: "comment",
              postId,
              comment: {
                id: comment.id,
                text: comment.text,
                userName: comment.user,
                userId: comment.userId,
                postPreview,
              },
            });
          }}
        />

        <AnimatePresence>
          {shareTarget && (
            <motion.div
              className="fixed inset-0 z-[400] flex items-end bg-black/50 backdrop-blur-sm"
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
              onClick={() => !shareToUserMutation.isPending && setShareTarget(null)}
            >
              <MotionBottomSheetPanel
                className="flex max-h-[min(72vh,640px)] w-full min-h-0 flex-col overflow-hidden rounded-t-[24px] border border-border/60 bg-background shadow-2xl uix-responsive-max-w"
                initial={prefersReducedMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
                onClick={(e) => e.stopPropagation()}
                disableSwipeDismiss={prefersReducedMotion}
                onDismiss={() => !shareToUserMutation.isPending && setShareTarget(null)}
                dragHandle={
                  <div className="flex w-full shrink-0 justify-center pt-3 pb-2" aria-hidden>
                    <div className="h-1 w-10 rounded-full bg-border" />
                  </div>
                }
              >
                <div className="flex items-center justify-between border-b border-border/40 px-4 pb-3 pt-1">
                  <p className="text-base font-bold">Поделиться</p>
                  <button
                    type="button"
                    className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                    aria-label="Закрыть"
                    disabled={shareToUserMutation.isPending}
                    onClick={() => setShareTarget(null)}
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>
                <MotionBottomSheetScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+12px))]">
                  {(() => {
                    const target = shareTarget;
                    const relatedPost =
                      target.kind === "post"
                        ? feedPosts.find((p) => p.id === target.postId) ?? null
                        : target.kind === "comment"
                          ? feedPosts.find((p) => p.id === target.postId) ?? null
                          : null;
                    const shareTitle =
                      target.kind === "post"
                        ? relatedPost
                          ? [relatedPost.author?.displayName, relatedPost.author?.surname].filter(Boolean).join(" ") || "Пост"
                          : "Пост"
                        : target.kind === "comment"
                          ? `Комментарий ${target.comment.userName || ""}`.trim()
                          : `Сториз ${target.story.userName || ""}`.trim();
                    const shareUrl =
                      target.kind === "post" && relatedPost
                        ? `${window.location.origin}${buildProfilePostPath({
                            postId: relatedPost.id,
                            linkCode: relatedPost.linkCode,
                            isMe: relatedPost.authorId === user?.id,
                            publicId: relatedPost.author?.publicId,
                            userId: relatedPost.authorId,
                            fallbackPath: "/posts",
                          })}`
                        : target.kind === "comment" && relatedPost
                          ? `${window.location.origin}${buildProfilePostPath({
                              postId: relatedPost.id,
                              linkCode: relatedPost.linkCode,
                              isMe: relatedPost.authorId === user?.id,
                              publicId: relatedPost.author?.publicId,
                              userId: relatedPost.authorId,
                              fallbackPath: "/posts",
                            })}?openComments=1&commentId=${encodeURIComponent(target.comment.id)}`
                          : target.kind === "story"
                            ? target.story.image
                            : "";
                    const copyLabel =
                      target.kind === "post"
                        ? "Копировать ссылку на пост"
                        : target.kind === "comment"
                          ? "Копировать ссылку на комментарий"
                          : "Копировать ссылку на сториз";

                    const runNativeShare = async () => {
                      try {
                        if (navigator.share) {
                          await navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl });
                          setShareTarget(null);
                          return;
                        }
                        if (shareUrl && navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(shareUrl);
                          toast({ title: "Ссылка скопирована" });
                          setShareTarget(null);
                        }
                      } catch (e) {
                        if (isNavigatorShareCancelled(e)) return;
                        toast({ title: "Не удалось поделиться", variant: "destructive" });
                      }
                    };

                    const copyLink = async () => {
                      if (!shareUrl) return;
                      try {
                        await navigator.clipboard.writeText(shareUrl);
                        toast({ title: "Ссылка скопирована" });
                        setShareTarget(null);
                      } catch {
                        toast({ title: "Не удалось скопировать", variant: "destructive" });
                      }
                    };

                    if (target.kind !== "story" && !relatedPost) {
                      return (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Исходный контент недоступен в ленте. Обновите страницу.
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
                          <span>{copyLabel}</span>
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
                                      shareToUserMutation.mutate({ target, toUserId: c.id })
                                    }
                                  >
                                    <UserAvatar
                                      avatarUrl={c.avatarUrl ?? undefined}
                                      displayName={[c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`}
                                      seed={c.id}
                                      size={40}
                                      className="h-10 w-10 rounded-xl"
                                      pointerEventsNone
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
                </MotionBottomSheetScrollArea>
              </MotionBottomSheetPanel>
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
              <MotionBottomSheetPanel
                className="flex w-full min-h-0 flex-col rounded-t-2xl border-t border-border/30 bg-background px-1 pt-2 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+8px))] shadow-2xl uix-responsive-max-w"
                initial={prefersReducedMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
                onClick={(e) => e.stopPropagation()}
                disableSwipeDismiss={prefersReducedMotion}
                onDismiss={() => setMyAvatarMenu(false)}
                dragHandle={
                  <div className="flex w-full shrink-0 justify-center pb-3 pt-1" aria-hidden>
                    <div className="h-1 w-10 rounded-full bg-border" />
                  </div>
                }
              >
                <MotionBottomSheetScrollArea
                  requireScrollAtTop={false}
                  className="flex min-h-0 flex-1 flex-col gap-0.5"
                >
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
                </MotionBottomSheetScrollArea>
              </MotionBottomSheetPanel>
            </motion.div>
          )}
        </AnimatePresence>

        <PostVideoTrimmerModal
          open={!!storyVideoTrimFile}
          file={storyVideoTrimFile}
          onOpenChange={handleStoryTrimmerOpenChange}
          onConfirm={handleStoryVideoTrimConfirm}
          maxSegmentSeconds={STORY_VIDEO_MAX_SECONDS}
          title="Видео для сториз"
          description={`До ${STORY_VIDEO_MAX_SECONDS} с: выберите фрагмент, как при загрузке видео в пост.`}
        />

        <UploadProgressBlockingOverlay
          open={storyUploading}
          title="Загрузка сториз"
          percent={storyUploadPercent}
          ariaLabel="Загрузка сториз"
          footnote={storyUploadPercent != null ? "Отправка файла на сервер…" : null}
        />

        <StoryCaptionPublishSheet
          open={storyCaptionPublishMediaUrl !== null}
          busy={storyPublishSaving}
          onCancel={() => setStoryCaptionPublishMediaUrl(null)}
          onPublish={async (caption) => {
            const url = storyCaptionPublishMediaUrl;
            if (!url) return;
            setStoryPublishSaving(true);
            try {
              await createStory(url, { caption: caption || undefined });
              toast({ title: "Сториз опубликована" });
              setStoryCaptionPublishMediaUrl(null);
              await refetchStories();
            } catch (err) {
              toast({
                title: err instanceof Error ? err.message : "Не удалось опубликовать сториз",
                variant: "destructive",
              });
            } finally {
              setStoryPublishSaving(false);
            }
          }}
        />

        <ReportContentDialog
          open={!!feedReportTarget}
          onOpenChange={(o) => {
            if (!o) setFeedReportTarget(null);
          }}
          target={feedReportTarget}
          contextLine="Пост в ленте"
        />
      </div>
    </div>
  );
}