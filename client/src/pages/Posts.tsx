import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Share2, Bookmark, Plus, PenSquare, Eye, MoreHorizontal, Trash2, Camera, ImageIcon, User, Pencil } from "lucide-react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import StoryViewer from "@/components/StoryViewer";
import CommentsModal from "@/components/CommentsModal";
import { useAuth } from "@/contexts/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { fetchFeed, formatPostTime, addReaction, removeReaction, recordPostView, updatePost, deletePost, sharePostToUser, type FeedPost, type ReactionUser } from "@/lib/posts";
import { PostMedia } from "@/components/PostMedia";
import { listContactsWithProfiles, type ContactUser } from "@/lib/users";
import { startDm } from "@/lib/search";
import { sendMessage } from "@/lib/chat";
import { useToast } from "@/hooks/use-toast";
import { resolveUrl } from "@/lib/api-base";
import {
  archiveStory,
  createStory,
  deleteStory,
  fetchStoriesFeed,
  fetchStoryViewers,
  likeStory,
  recordStoryView,
  unlikeStory,
  uploadStoryMedia,
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
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { playLikeActionSound } from "@/lib/send-sound";

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
const FEED_RENDER_OVERSCAN = 2;
const FEED_POST_ESTIMATED_HEIGHT_PX = 560;

function MeasuredFeedItem({
  postId,
  onHeightChange,
  children,
}: {
  postId: string;
  onHeightChange: (postId: string, height: number) => void;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

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

function splitPostTextParts(text: string): string[] {
  return text.split(/(https?:\/\/[^\s]+|www\.[^\s]+|#[a-zA-Zа-яёА-ЯЁ0-9_]+)/g);
}

function normalizeHref(part: string): string {
  if (/^https?:\/\//i.test(part)) return part;
  return `https://${part}`;
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
          {splitPostTextParts(text).map((part, i) => {
            if (!part) return null;
            if (part.startsWith("#")) {
              return (
                <button
                  key={i}
                  type="button"
                  className="text-primary font-medium hover:underline underline-offset-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHashtagClick(part.slice(1).toLowerCase());
                  }}
                >
                  {part}
                </button>
              );
            }
            if (/^(https?:\/\/|www\.)/i.test(part)) {
              const href = normalizeHref(part);
              return (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener nofollow"
                  className="text-primary underline decoration-primary/55 underline-offset-[3px] break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {part}
                </a>
              );
            }
            return <span key={i}>{part}</span>;
          })}
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

export default function Posts() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [sharePostId, setSharePostId] = useState<string | null>(null);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  const [editPost, setEditPost] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [shatteringPostIds, setShatteringPostIds] = useState<Set<string>>(new Set());
  const [hashtagFilter, setHashtagFilter] = useState<string | null>(null);
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
    const totalItems = feedPosts.length;
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
      const row = feedPosts[i];
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
  }, [feedPosts, feedScrollTop, feedViewportHeight, feedHeightsVersion]);

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
      { rootMargin: "200px", threshold: 0.1 }
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

  const { data: storiesFeed = [], isLoading: storiesLoading, isError: storiesError, refetch: refetchStories } = useQuery({
    queryKey: ["stories", "feed"],
    queryFn: fetchStoriesFeed,
    enabled: !!user,
  });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: ({ postId, text, imageUrl, mediaUrls }: { postId: string; text: string; imageUrl?: string | null; mediaUrls?: string[] | null }) =>
      updatePost(postId, { text, imageUrl, mediaUrls }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
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
          const stories = Array.isArray(a.stories) ? a.stories : [];
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
        });

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
      return [{ id: item?.id ?? idx, image: (item as { image?: string })?.image ?? "", userName: (item as { name?: string })?.name ?? "", userAvatar: (item as { avatar?: string })?.avatar ?? "", time: (item as { time?: string })?.time ?? "" }];
    }
    const author = (item as { author?: { id?: string; displayName: string | null; avatarUrl: string | null; publicId: number } }).author;
    const name = author?.displayName || (item as { name?: string }).name || `ID ${author?.publicId ?? ""}`;
    const avatar = author?.avatarUrl ? resolveUrl(author.avatarUrl) : (item as { avatar?: string }).avatar ?? avatarMain;
    return (item.stories as {
      id: string;
      mediaUrl: string;
      createdAt: string;
      expiresAt?: string;
      likesCount?: number;
      isLiked?: boolean;
    }[]).map((s) => ({
      id: s.id,
      image: resolveUrl(s.mediaUrl),
      userName: name,
      userAvatar: avatar,
      time: formatPostTime(s.createdAt),
      authorId: author?.id ?? (item as { authorId?: string }).authorId,
      expiresAt: s.expiresAt,
      likesCount: Number(s.likesCount ?? 0),
      isLiked: s.isLiked === true,
    }));
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
  const wrappedMyCircleLongPress = {
    onPointerDown: (e: React.PointerEvent) => {
      longPressActiveRef.current = false;
      myCircleLongPress.onPointerDown();
    },
    onPointerUp: () => {
      myCircleLongPress.onPointerUp();
    },
    onPointerLeave: () => myCircleLongPress.onPointerLeave(),
    onPointerCancel: () => myCircleLongPress.onPointerCancel(),
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
          
          {/* Stories Section */}
          <div className="py-4 border-b border-border/50 bg-background/50">
            <div className="flex gap-4 overflow-x-auto hide-scrollbar uix-content-x items-center">
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
                  onClick={() => {
                    if (isMe) {
                      handleMyCircleTap();
                    } else {
                      setActiveStoryIndex(idx);
                    }
                  }}
                  {...(isMe ? wrappedMyCircleLongPress : {})}
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
                          "absolute bottom-0 right-0 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-white transition-colors",
                          storyUploading ? "bg-amber-500" : "bg-primary hover:bg-primary/90 active:bg-primary/80"
                        )}
                        aria-label="Открыть меню моей истории"
                        disabled={storyUploading}
                      >
                        {storyUploading ? (
                          <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
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
                const latestTwoComments = latestComments
                  .slice(0, 2)
                  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const hasCaption = safeText.trim().length > 0;
                const article = (
              <article className="uix-content-x py-[var(--uix-space-4)] border-b border-border/40 hover:bg-secondary/15 transition-colors duration-200 ease-out">
                <div className="flex items-start justify-between gap-[var(--uix-space-3)] mb-[var(--uix-space-3)]">
                  <div
                    className="flex min-w-0 flex-1 items-center gap-[var(--uix-space-3)] cursor-pointer group"
                    onClick={() => setLocation(authorProfilePath)}
                  >
                    <UserAvatar
                      avatarUrl={post.author?.avatarUrl ?? undefined}
                      displayName={post.channelName || (post.author ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ") : null) || `ID ${post.author?.publicId ?? post.authorId}`}
                      seed={String(post.authorId)}
                      size={40}
                      className="w-10 h-10 rounded-xl object-cover group-hover:opacity-80 transition-opacity flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-semibold text-[15px] leading-tight group-hover:text-primary transition-colors truncate"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(postDetailPath);
                        }}
                      >
                        {post.channelName || (post.author ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ") : null) || `ID ${post.author?.publicId ?? post.authorId}`}
                      </h3>
                      <p
                        className="mt-[var(--uix-space-1)] uix-text-caption text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(postDetailPath);
                        }}
                      >
                        {formatPostTime(post.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="relative shrink-0 pt-0.5">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary/80 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuPostId(menuPostId === post.id ? null : post.id);
                      }}
                      aria-label="Меню поста"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    {post.authorId === user?.id && menuPostId === post.id && (
                      <div className="absolute right-0 top-full mt-[var(--uix-space-2)] py-[var(--uix-space-1)] bg-background border border-border/80 rounded-xl shadow-lg z-50 min-w-[168px] overflow-hidden">
                        <button
                          type="button"
                          className="w-full px-[var(--uix-space-3)] py-2.5 text-left text-[14px] hover:bg-secondary/70 flex items-center gap-[var(--uix-space-2)] min-h-[44px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditPost(post);
                            setEditText(post.text);
                            setEditImageUrl(post.imageUrl ?? "");
                            setMenuPostId(null);
                          }}
                        >
                          <PenSquare className="w-4 h-4" />
                          Редактировать
                        </button>
                        <button
                          type="button"
                          className="w-full px-[var(--uix-space-3)] py-2.5 text-left text-[14px] hover:bg-red-500/10 text-red-600 flex items-center gap-[var(--uix-space-2)] min-h-[44px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Удалить пост?")) {
                              setShatteringPostIds((s) => new Set(s).add(post.id));
                              setMenuPostId(null);
                              deletePostMutation.mutate(post.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Удалить пост
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Post Content */}
                <div>
                  <FeedPostCaption
                    postId={post.id}
                    text={safeText}
                    expanded={expandedPostIds.has(post.id)}
                    onToggleExpand={() => togglePostExpand(post.id)}
                    onHashtagClick={(tag) => setHashtagFilter(tag)}
                  />
                  <PostMedia
                    mediaUrls={post.mediaUrls?.length ? post.mediaUrls : post.imageUrl ? [post.imageUrl] : []}
                    layout={post.mediaLayout ?? null}
                  />
                </div>

                {latestTwoComments.length > 0 && (
                  <div className="mb-2.5 flex flex-col gap-1.5">
                    {latestTwoComments.map((comment) => (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() => setActiveCommentPostId(post.id)}
                        className="w-full text-left rounded-xl border border-border/50 bg-secondary/35 px-2.5 py-1.5 hover:bg-secondary/50 transition-colors"
                        aria-label={`Открыть комментарии к посту. Комментарий: ${comment.user}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[12px] font-medium text-foreground/90 truncate">{comment.user}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">{formatPostTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-[13px] leading-snug text-foreground/85 line-clamp-1 break-words">{comment.text}</p>
                      </button>
                    ))}
                    {post.commentsCount > latestTwoComments.length && (
                      <button
                        type="button"
                        onClick={() => setActiveCommentPostId(post.id)}
                        className="self-start text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Ещё комментарии ({post.commentsCount})
                      </button>
                    )}
                  </div>
                )}

                {/* Post Actions */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2 relative">
                    {/* Reactions Pill */}
                    <div
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
                        "flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary transition-colors cursor-pointer border active:scale-95 select-none",
                        (post.myReaction ?? null)
                          ? "bg-primary/10 border-primary/30 text-foreground"
                          : "text-secondary-foreground hover:bg-secondary/80 border-border/30"
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
                        import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                        setShowReactionPicker(showReactionPicker === post.id ? null : post.id);
                      }}
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-full bg-secondary transition-colors border",
                        showReactionPicker === post.id 
                          ? "text-primary border-primary/50 bg-primary/10" 
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/80 border-border/30"
                      )}
                      aria-label="Добавить реакцию"
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
                              import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
                              playLikeActionSound();
                              reactionMutation.mutate({ postId: post.id, emoji });
                              setShowReactionPicker(null);
                            }}
                            className="text-2xl hover:scale-125 transition-transform active:scale-95"
                            aria-label={`Реакция ${emoji}`}
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
                    {(post.viewsCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" />
                        {post.viewsCount}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                      aria-label="Сохранить в избранное"
                    >
                      <Bookmark className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); setMenuPostId(null); setSharePostId(post.id); }}
                      aria-label="Поделиться"
                    >
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

              </article>
                );
                if (isShattering) {
                  return (
                    <MeasuredFeedItem key={post.id} postId={post.id} onHeightChange={updateFeedPostHeight}>
                    <ShatterEffect
                      onComplete={() => {
                        setShatteringPostIds((s) => { const n = new Set(s); n.delete(post.id); return n; });
                        queryClient.invalidateQueries({ queryKey: ["posts"] });
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
                  <MeasuredFeedItem key={post.id} postId={post.id} onHeightChange={updateFeedPostHeight}>
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
                  <MoreHorizontal className="h-4 w-4 rotate-90" />
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
                    <div key={viewer.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary/60">
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
        />

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