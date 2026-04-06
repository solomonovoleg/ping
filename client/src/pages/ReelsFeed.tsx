/**
 * Вертикальная видео-лента iSee.
 *
 * Блоки доработки:
 * 1) Плеер: пул из 3 `<video>` + poster + Priority Hints; `link rel=preload as=video` (следующий — high, дальние — low); пауза по `visibilitychange`.
 * 2) Хром: прогресс внизу, свайп вниз от верха ленты — закрыть, правый рельс действий.
 * 3) Соцслой: комментарии, сохранение, шаринг, двойной тап / сердце.
 * 4) Данные: video-only с сервера; For You / отдельный рекомендер — при необходимости позже.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  ChevronLeft,
  Heart,
  MessageCircle,
  Send,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import { PageTitle } from "@/components/PageTitle";
import { FeedScrollRootContext } from "@/contexts/FeedScrollRootContext";
import type { FeedReelsInteraction } from "@/components/FeedInlineVideo";
import CommentsModal from "@/components/CommentsModal";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { ReelsFeedSkeleton } from "@/features/reels/ReelsFeedSkeleton";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { useAuth } from "@/contexts/AuthContext";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { triggerLightHaptic, triggerSelectionHaptic } from "@/lib/capacitor-native";
import { ReelsPostShareSheet } from "@/features/reels/ReelsPostShareSheet";
import { ReelsVideoPoolLayer } from "@/features/reels/ReelsVideoPoolLayer";
import {
  addReaction,
  removeReaction,
  fetchFeed,
  fetchPost,
  recordPostViewBestEffort,
  formatPostTime,
  savePost,
  unsavePost,
  type FeedPost,
} from "@/lib/posts";
import { DOUBLE_TAP_LIKE_EMOJI } from "@/lib/double-tap-like-reaction";
import { applyReactionOptimistic, updateFeedPostInCache } from "@/lib/feed-query-cache";
import { buildProfilePath, buildProfilePostPath, buildReelsPostPath } from "@/lib/profile-route";
import {
  getPrimaryVideoUrlForPost,
  getReelPosterUrlForPost,
  postHasUploadedVideo,
} from "@/lib/feed-video-post";
import { useToast } from "@/hooks/use-toast";
import { playLikeActionSound } from "@/lib/send-sound";
import { formatCompactCountRu } from "@/lib/number-format";
import {
  computeReelsFloorIndex,
  computeReelsScrollP,
  reelsDistantVideoPreloadIndices,
} from "@/lib/reels-video";

const REELS_FEED_PAGE_SIZE_DEFAULT = 5;
const REELS_FEED_PAGE_SIZE_IOS = 3;
const REELS_FEED_PAGE_SIZE_SLOW_NETWORK = 2;
/** Debounce подгрузки страниц ленты при быстром свайпе (меньше параллельных запросов). */
const REELS_FETCH_NEXT_DEBOUNCE_MS = 300;

/** До первого замера скроллера `clientHeight` может быть 0 — пул `<video>` не монтировался → чёрный экран. */
function initialReelsViewportHeightPx(): number {
  if (typeof window === "undefined") return 0;
  return Math.max(280, window.innerHeight);
}
const PULL_CLOSE_THRESHOLD_PX = 72;
const PULL_CLOSE_MAX_DRAG_PX = 120;

/** Рельс на видео: без тёмных кругов — только тень у иконки/цифр (ближе к Instagram Reels). */
const REELS_RAIL_HIT = "flex h-11 w-11 shrink-0 items-center justify-center";
const REELS_RAIL_ICON = cn(
  "h-[26px] w-[26px] shrink-0",
  "drop-shadow-[0_1px_0_rgba(0,0,0,0.42),0_2px_14px_rgba(0,0,0,0.58)]",
);
const REELS_RAIL_STROKE = 1.5;
const REELS_RAIL_COUNT =
  "text-[12px] font-semibold tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.92),0_0_10px_rgba(0,0,0,0.35)]";

function parseReelsSearch(search: string): { startPostId: string; hashtag: string } {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  try {
    const p = new URLSearchParams(raw);
    return {
      startPostId: p.get("post")?.trim() ?? "",
      hashtag: p.get("tag")?.trim() ?? "",
    };
  } catch {
    return { startPostId: "", hashtag: "" };
  }
}

/** Сегмент `/p/…` или `?post=` — UUID или короткий `linkCode` (как в `buildReelsPostPath`). */
function postMatchesReelsRouteRef(p: FeedPost, ref: string): boolean {
  const r = ref.trim();
  if (!r) return false;
  if (p.id === r) return true;
  const lc = typeof p.linkCode === "string" ? p.linkCode.trim() : "";
  return Boolean(lc && lc === r);
}

export default function ReelsFeed() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [matchReelsPrettyPath, reelsPathParams] = useRoute("/reels/u/:id/p/:postId");
  const { startPostId: queryPostId, hashtag } = useMemo(() => parseReelsSearch(search), [search]);
  const pathPostId = reelsPathParams?.postId?.trim() ?? "";
  const startPostId = pathPostId || queryPostId;
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const isLikelyIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent ?? "";
    const platform = navigator.platform ?? "";
    const touchPoints = navigator.maxTouchPoints ?? 0;
    const iosUa = /iPhone|iPad|iPod/i.test(ua);
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
  const reelsFeedPageSize = isSlowNetwork
    ? REELS_FEED_PAGE_SIZE_SLOW_NETWORK
    : isLikelyIOS
      ? REELS_FEED_PAGE_SIZE_IOS
      : REELS_FEED_PAGE_SIZE_DEFAULT;

  const feedOpts = useMemo(() => (hashtag ? { hashtag } : undefined), [hashtag]);
  const hashtagKey = hashtag || "";
  const reelsFeedQueryKey = useMemo(
    () => ["posts", "reels-feed", hashtagKey, reelsFeedPageSize] as const,
    [hashtagKey, reelsFeedPageSize],
  );
  const getNextReelsFeedPageParam = useCallback((lastPage: FeedPost[], allPages: FeedPost[][]) => {
    if (!Array.isArray(lastPage)) return undefined;
    return lastPage.length < reelsFeedPageSize ? undefined : allPages.length * reelsFeedPageSize;
  }, [reelsFeedPageSize]);

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
    queryKey: reelsFeedQueryKey,
    queryFn: ({ pageParam }) =>
      fetchFeed(reelsFeedPageSize, pageParam as number, { ...feedOpts, videoOnly: true }),
    initialPageParam: 0,
    getNextPageParam: getNextReelsFeedPageParam,
  });

  /** При возврате на iSee обновляем только первую страницу видео-ленты. */
  useEffect(() => {
    if (queryClient.getQueryData(reelsFeedQueryKey) === undefined) return;
    void queryClient.fetchInfiniteQuery({
      queryKey: reelsFeedQueryKey,
      queryFn: ({ pageParam }) =>
        fetchFeed(reelsFeedPageSize, pageParam as number, { ...feedOpts, videoOnly: true }),
      initialPageParam: 0,
      getNextPageParam: getNextReelsFeedPageParam,
      pages: 1,
      staleTime: 0,
    });
  }, [queryClient, reelsFeedQueryKey, feedOpts, getNextReelsFeedPageParam, reelsFeedPageSize]);

  const flatFeed = useMemo(
    () => (Array.isArray(feedData?.pages) ? (feedData.pages as FeedPost[][]).flat() : []),
    [feedData?.pages],
  );

  /** Сервер уже отдаёт только видео; фильтр — страховка от рассинхрона. */
  const videoPostsOrdered = useMemo(() => flatFeed.filter(postHasUploadedVideo), [flatFeed]);
  const startInLoadedFeed = Boolean(startPostId && flatFeed.some((p) => postMatchesReelsRouteRef(p, startPostId)));

  /** Одиночный пост по `?post=` — сразу, иначе при глубокой ссылке ждём конца пагинации (чёрный экран без видео). */
  const { data: seedPost } = useQuery({
    queryKey: ["post", startPostId],
    queryFn: () => fetchPost(startPostId),
    enabled: Boolean(startPostId) && !startInLoadedFeed,
  });

  useEffect(() => {
    if (!startPostId || startInLoadedFeed || !hasNextPage || isFetchingNextPage) return;
    const pageCount = feedData?.pages?.length ?? 0;
    if (pageCount >= 40) return;
    void fetchNextPage();
  }, [
    startPostId,
    startInLoadedFeed,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    feedData?.pages?.length,
  ]);

  const mergedVideoPosts = useMemo(() => {
    const base = videoPostsOrdered;
    if (!startPostId) return base;
    if (base.some((p) => postMatchesReelsRouteRef(p, startPostId))) return base;
    if (seedPost && postHasUploadedVideo(seedPost) && !base.some((p) => p.id === seedPost.id)) {
      return [seedPost, ...base];
    }
    return base;
  }, [videoPostsOrdered, startPostId, seedPost]);

  /** Легаси `/reels?post=` → канон `/reels/u/…/p/…` (replace). Старые ссылки продолжают открываться. */
  const canonicalizedLegacyPostRef = useRef<string | null>(null);
  useEffect(() => {
    if (matchReelsPrettyPath || !queryPostId) return;
    if (canonicalizedLegacyPostRef.current === queryPostId) return;
    const pid = queryPostId;
    const p =
      mergedVideoPosts.find((x) => x.id === pid) ??
      (seedPost && seedPost.id === pid && postHasUploadedVideo(seedPost) ? seedPost : null);
    if (!p || !postHasUploadedVideo(p)) return;
    const pretty = buildReelsPostPath({
      postId: p.id,
      linkCode: p.linkCode,
      isMe: p.authorId === user?.id,
      publicId: p.author?.publicId,
      userId: p.authorId,
    });
    if (pretty.includes("?post=")) return;
    canonicalizedLegacyPostRef.current = pid;
    const tagQs = hashtag ? `?tag=${encodeURIComponent(hashtag)}` : "";
    setLocation(`${pretty}${tagQs}`, { replace: true });
  }, [matchReelsPrettyPath, queryPostId, mergedVideoPosts, seedPost, user?.id, hashtag, setLocation]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(initialReelsViewportHeightPx);
  const [activeIndex, setActiveIndex] = useState(0);
  const [soundPostId, setSoundPostId] = useState<string | null>(null);
  const [reelProgress, setReelProgress] = useState(0);
  const [dismissPullPx, setDismissPullPx] = useState(0);
  const dismissPullRef = useRef(0);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [shareSheetPost, setShareSheetPost] = useState<FeedPost | null>(null);
  const didScrollToStartRef = useRef(false);
  const prevActiveIndexRef = useRef<number | null>(null);
  const seenViewsRef = useRef<Set<string>>(new Set());
  const [doubleTapHeartPostId, setDoubleTapHeartPostId] = useState<string | null>(null);
  const doubleTapHeartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollMetrics, setScrollMetrics] = useState<{ floorIdx: number; p: number }>({ floorIdx: 0, p: 0 });
  const scrollMetricsRafRef = useRef<number | null>(null);
  const fetchNextDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Единая точка: индекс активного ролика + метрики прогресс-бара (из фактического scrollTop). */
  const applyReelsScrollMetrics = useCallback(
    (el: HTMLDivElement) => {
      if (viewportH <= 0) return;
      const H = viewportH;
      const n = mergedVideoPosts.length;
      if (n === 0) return;
      const st = el.scrollTop;
      const nextIdx = Math.max(0, Math.min(n - 1, Math.round(st / H)));
      setActiveIndex((prev) => (prev === nextIdx ? prev : nextIdx));
      const floorIdx = computeReelsFloorIndex(st, H, n);
      const p = computeReelsScrollP(st, floorIdx, H);
      setScrollMetrics((prev) =>
        prev.floorIdx === floorIdx && prev.p === p ? prev : { floorIdx, p },
      );
    },
    [viewportH, mergedVideoPosts.length],
  );

  useEffect(() => {
    didScrollToStartRef.current = false;
  }, [startPostId]);

  useEffect(() => {
    return () => {
      if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight || Math.round(el.getBoundingClientRect().height);
      if (h > 0) setViewportH(h);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  /** После первого layout иногда `clientHeight` ещё 0; без высоты пул видео не монтируется (чёрный экран). */
  useLayoutEffect(() => {
    if (viewportH > 0 || mergedVideoPosts.length === 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const h = el.clientHeight || Math.round(el.getBoundingClientRect().height);
      if (h > 0) setViewportH(h);
    };
    raf = requestAnimationFrame(() => {
      requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [viewportH, mergedVideoPosts.length]);

  useLayoutEffect(() => {
    if (didScrollToStartRef.current || !startPostId || viewportH <= 0) return;
    const idx = mergedVideoPosts.findIndex((p) => postMatchesReelsRouteRef(p, startPostId));
    if (idx < 0) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = idx * viewportH;
    didScrollToStartRef.current = true;
    applyReelsScrollMetrics(el);
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, [startPostId, mergedVideoPosts, viewportH, applyReelsScrollMetrics]);

  /**
   * Звук только после явного тапа по динамику.
   * Иначе iOS / Chrome блокируют autoplay без user gesture — `play()` падает, ролик «не крутится».
   */
  useEffect(() => {
    if (mergedVideoPosts.length === 0) return;
    setSoundPostId((cur) => {
      if (cur && mergedVideoPosts.some((p) => p.id === cur)) return cur;
      return null;
    });
  }, [mergedVideoPosts]);

  useEffect(() => {
    setReelProgress(0);
  }, [activeIndex]);

  useEffect(() => {
    if (reducedMotion) {
      prevActiveIndexRef.current = activeIndex;
      return;
    }
    if (prevActiveIndexRef.current !== null && prevActiveIndexRef.current !== activeIndex) {
      triggerSelectionHaptic();
    }
    prevActiveIndexRef.current = activeIndex;
  }, [activeIndex, reducedMotion]);

  /**
   * Один rAF на кадр: и индекс слайда, и (floorIdx, p) — меньше коммитов React во время инерции.
   * `scroll-behavior: smooth` + snap на мобильных даёт рывки; скролл — `auto`, плавность только у keyboard scrollBy.
   */
  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || viewportH <= 0) return;
    if (scrollMetricsRafRef.current != null) return;
    scrollMetricsRafRef.current = requestAnimationFrame(() => {
      scrollMetricsRafRef.current = null;
      const el2 = scrollerRef.current;
      if (!el2 || viewportH <= 0) return;
      applyReelsScrollMetrics(el2);
    });
  }, [viewportH, applyReelsScrollMetrics]);

  /** После появления данных / высоты вьюпорта и после snap на iOS (иногда нет финального `scroll`). */
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el || viewportH <= 0 || mergedVideoPosts.length === 0) return;
    applyReelsScrollMetrics(el);
  }, [viewportH, mergedVideoPosts.length, applyReelsScrollMetrics]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const sync = () => {
      const target = scrollerRef.current;
      if (target) applyReelsScrollMetrics(target);
    };
    /** Двойной rAF: дождаться snap / layout после отпускания пальца (WebKit). */
    const syncAfterGesture = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(sync);
      });
    };
    el.addEventListener("scrollend", sync);
    el.addEventListener("touchend", syncAfterGesture, { passive: true });
    return () => {
      el.removeEventListener("scrollend", sync);
      el.removeEventListener("touchend", syncAfterGesture);
    };
  }, [applyReelsScrollMetrics]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || mergedVideoPosts.length === 0) return;
    const preloadThresholdFromEnd = isSlowNetwork ? 1 : 2;
    if (activeIndex < mergedVideoPosts.length - preloadThresholdFromEnd) return;
    if (fetchNextDebounceRef.current) clearTimeout(fetchNextDebounceRef.current);
    fetchNextDebounceRef.current = setTimeout(() => {
      fetchNextDebounceRef.current = null;
      void fetchNextPage();
    }, REELS_FETCH_NEXT_DEBOUNCE_MS);
    return () => {
      if (fetchNextDebounceRef.current) {
        clearTimeout(fetchNextDebounceRef.current);
        fetchNextDebounceRef.current = null;
      }
    };
  }, [activeIndex, mergedVideoPosts.length, hasNextPage, isFetchingNextPage, fetchNextPage, isSlowNetwork]);

  useEffect(() => {
    const post = mergedVideoPosts[activeIndex];
    if (!post || seenViewsRef.current.has(post.id)) return;
    seenViewsRef.current.add(post.id);
    recordPostViewBestEffort(post.id);
  }, [mergedVideoPosts, activeIndex]);

  /**
   * Дальние ролики (+2/+3, −2/−3): `<link rel=preload as=video>` — байты в HTTP-кеше без лишних `<video>`.
   */
  useEffect(() => {
    const n = mergedVideoPosts.length;
    if (n === 0) return;
    const { floorIdx, p } = scrollMetrics;
    const indices = reelsDistantVideoPreloadIndices(floorIdx, p, n);
    const limitedIndices = isSlowNetwork ? indices.slice(0, 1) : isLikelyIOS ? indices.slice(0, 2) : indices;
    const links: HTMLLinkElement[] = [];
    for (const idx of limitedIndices) {
      const post = mergedVideoPosts[idx];
      const u = post ? getPrimaryVideoUrlForPost(post) : null;
      if (!u) continue;
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "video";
      link.href = resolveUrl(u);
      if ("fetchPriority" in link) {
        (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = "low";
      }
      document.head.appendChild(link);
      links.push(link);
    }
    return () => {
      links.forEach((l) => l.remove());
    };
  }, [scrollMetrics, mergedVideoPosts, isLikelyIOS, isSlowNetwork]);

  /** Следующий клип: приоритетный preload в HTTP-кеше (в дополнение к `<video preload=auto>` в пуле). */
  useEffect(() => {
    const n = mergedVideoPosts.length;
    if (n === 0) return;
    const nextIdx = activeIndex + 1;
    if (nextIdx >= n) return;
    const post = mergedVideoPosts[nextIdx];
    const u = post ? getPrimaryVideoUrlForPost(post) : null;
    if (!u) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "video";
    link.href = resolveUrl(u);
    if ("fetchPriority" in link) {
      (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = "high";
    }
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [activeIndex, mergedVideoPosts]);

  /** Постер следующего слайда — в кеш до свайпа (обложка без чёрного кадра). */
  useEffect(() => {
    const n = mergedVideoPosts.length;
    if (n === 0) return;
    const nextIdx = activeIndex + 1;
    if (nextIdx >= n) return;
    const post = mergedVideoPosts[nextIdx];
    const p = post ? getReelPosterUrlForPost(post) : null;
    if (!p) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = resolveUrl(p);
    if ("fetchPriority" in link) {
      (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = "high";
    }
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [activeIndex, mergedVideoPosts]);

  /** Как в нативных рилсах: вкладка в фоне — стоп декодера и сеть; возврат — играет только активный слот. */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        document.querySelectorAll("video[data-feed-autoplay]").forEach((node) => {
          (node as HTMLVideoElement).pause();
        });
        return;
      }
      const active = document.querySelector("video[data-reels-active=\"1\"]") as HTMLVideoElement | null;
      if (active) void active.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = scrollerRef.current;
      if (!el || viewportH <= 0 || mergedVideoPosts.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        el.scrollBy({ top: viewportH, behavior: reducedMotion ? "auto" : "smooth" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        el.scrollBy({ top: -viewportH, behavior: reducedMotion ? "auto" : "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewportH, mergedVideoPosts.length, reducedMotion]);

  /** Свайп вниз при scrollTop≈0 — закрыть (как жест «выйти» из iSee). */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || reducedMotion) return;
    let startY = 0;
    let startScroll = 0;
    let armed = false;
    const onStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startScroll = el.scrollTop;
      armed = startScroll <= 2 && activeIndex === 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!armed) return;
      if (el.scrollTop > 2) {
        armed = false;
        dismissPullRef.current = 0;
        setDismissPullPx(0);
        return;
      }
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        e.preventDefault();
        const v = Math.min(PULL_CLOSE_MAX_DRAG_PX, dy * 0.45);
        dismissPullRef.current = v;
        setDismissPullPx(v);
      }
    };
    const onEnd = () => {
      if (dismissPullRef.current >= PULL_CLOSE_THRESHOLD_PX) {
        setLocation("/posts");
      }
      dismissPullRef.current = 0;
      setDismissPullPx(0);
      armed = false;
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [reducedMotion, setLocation, activeIndex]);

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
        title: e instanceof Error ? e.message : "Не удалось изменить реакцию",
        variant: "destructive",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "reels-feed"] });
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
      toast({ title: save ? "Сохранено в профиль" : "Убрано из сохранённого" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "reels-feed"] });
    },
  });

  const triggerDoubleTapHeart = useCallback((postId: string) => {
    if (doubleTapHeartTimerRef.current) clearTimeout(doubleTapHeartTimerRef.current);
    setDoubleTapHeartPostId(postId);
    doubleTapHeartTimerRef.current = setTimeout(() => {
      setDoubleTapHeartPostId((cur) => (cur === postId ? null : cur));
      doubleTapHeartTimerRef.current = null;
    }, 460);
  }, []);

  const mutateFireReaction = useCallback(
    (post: FeedPost) => {
      const mine = post.myReaction;
      reactionMutation.mutate({
        postId: post.id,
        emoji: mine === DOUBLE_TAP_LIKE_EMOJI ? null : DOUBLE_TAP_LIKE_EMOJI,
      });
    },
    [reactionMutation],
  );

  const reelInteractionForPost = useCallback(
    (post: FeedPost): FeedReelsInteraction | null =>
      user
        ? {
            onDoubleTapFire: () => {
              void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) => triggerLightHaptic());
              playLikeActionSound();
              triggerDoubleTapHeart(post.id);
              mutateFireReaction(post);
            },
          }
        : null,
    [user, mutateFireReaction, triggerDoubleTapHeart],
  );

  const reelsSwipeToFeed = useCallback(() => {
    void triggerLightHaptic();
    if (hashtag) {
      setLocation(`/posts?tag=${encodeURIComponent(hashtag)}`);
    } else {
      setLocation("/posts");
    }
  }, [hashtag, setLocation]);

  const reelsSwipeToProfile = useCallback(() => {
    void triggerLightHaptic();
    setLocation("/profile/me");
  }, [setLocation]);

  const forceReelSoundByGesture = useCallback((postId: string, soundOn: boolean) => {
    const root = scrollerRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll("video[data-reel-post-id]")) as HTMLVideoElement[];
    const target = videos.find((v) => v.dataset.reelPostId === postId);
    if (!target) return;
    if (!soundOn) {
      target.muted = true;
      return;
    }
    target.muted = false;
    target.volume = 1;
    void target.play().catch(() => {});
  }, []);

  const activePost = mergedVideoPosts[activeIndex];
  const activePostAuthorId = activePost?.authorId;

  const feedErrorText =
    feedError instanceof Error && feedError.message.trim()
      ? feedError.message
      : "Проверьте интернет и попробуйте снова";

  if (isError && !feedData?.pages?.length) {
    return (
      <div className="flex flex-1 min-h-0 flex-col bg-black pt-[env(safe-area-inset-top,0px)] text-white">
        <PageTitle title="iSee" />
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 px-4">
          <ErrorWithRetry
            surface="darkVideo"
            description={feedErrorText}
            onRetry={() => void refetch()}
          />
          <TapScaleButton
            type="button"
            className="text-sm text-white/80 hover:text-white"
            onClick={() => setLocation("/posts")}
          >
            К ленте
          </TapScaleButton>
        </div>
      </div>
    );
  }

  if (isLoading && flatFeed.length === 0) {
    return <ReelsFeedSkeleton />;
  }

  if (mergedVideoPosts.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col bg-black pt-[env(safe-area-inset-top,0px)] text-white">
        <PageTitle title="iSee" />
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-2 px-4">
          {isFetching && !isLoading ? (
            <div
              className="flex w-full max-w-sm items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 px-3 text-xs text-white/75"
              role="status"
              aria-live="polite"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white border-t-transparent animate-spin"
                aria-hidden
              />
              Обновляем iSee…
            </div>
          ) : null}
          <ListEmptyState
            surface="darkVideo"
            icon={Video}
            title="В iSee пока нет роликов"
            description="Показываем только посты с загруженным видео. Встроенные ролики из ссылок в тексте сюда не попадают. Обновите: потяните вниз или нажмите «Обновить»."
            actionLabel="К ленте"
            onAction={() => setLocation("/posts")}
            secondaryActionLabel="Обновить"
            onSecondaryAction={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  const scrollRootRef = scrollerRef;
  const dismissOpacity = 1 - dismissPullPx / (PULL_CLOSE_MAX_DRAG_PX * 1.25);
  const reelsSuppressPlayback = activeCommentPostId !== null || shareSheetPost !== null;

  return (
    <FeedScrollRootContext.Provider value={scrollRootRef}>
      <div
        className="relative flex flex-1 min-h-0 w-full max-w-full min-w-0 flex-col bg-black text-white"
        style={{
          transform: dismissPullPx > 0 ? `translateY(${dismissPullPx}px)` : undefined,
          opacity: dismissPullPx > 0 ? dismissOpacity : 1,
          transition: dismissPullPx === 0 ? "opacity 0.2s ease, transform 0.2s ease" : undefined,
        }}
      >
        <PageTitle title="iSee" />
        {/* Оверлей: один safe-area (main для /reels без pt-safe), видео на весь экран */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col">
          <div className="pointer-events-auto bg-gradient-to-b from-black/75 via-black/35 to-transparent pb-1">
            <div className="flex h-11 min-h-[var(--uix-touch-min)] items-center gap-1 px-1.5 pt-[env(safe-area-inset-top,0px)]">
              <TapScaleButton
                type="button"
                haptic={false}
                className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] shrink-0 items-center justify-center rounded-full text-white/95"
                aria-label="Назад к ленте"
                onClick={() => setLocation("/posts")}
              >
                <ChevronLeft className="h-6 w-6 drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]" aria-hidden />
              </TapScaleButton>
              <div className="min-w-0 flex-1 text-center pr-10">
                {hashtag ? (
                  <span className="truncate text-[13px] font-semibold tracking-wide text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
                    #{hashtag}
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
                    iSee
                  </span>
                )}
              </div>
            </div>
            <div className="px-3">
              <div
                className="h-[2px] w-full overflow-hidden rounded-full bg-white/18"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(Math.max(0, Math.min(1, reelProgress)) * 100)}
                aria-label="Прогресс ролика"
              >
                <div
                  className="h-full origin-left rounded-full bg-white/90 will-change-transform"
                  style={{ transform: `scaleX(${Math.max(0, Math.min(1, reelProgress))})` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          ref={scrollerRef}
          role="list"
          aria-label="Вертикальная лента iSee"
          className={cn(
            "min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-y-contain touch-pan-y bg-black scroll-auto",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
          onScroll={onScroll}
        >
          <div className="relative flex w-full min-w-0 flex-col">
            <ReelsVideoPoolLayer
              posts={mergedVideoPosts}
              activeIndex={activeIndex}
              viewportH={viewportH}
              soundPostId={soundPostId}
              onReelProgress={setReelProgress}
              reelInteractionForPost={reelInteractionForPost}
              onReelsSwipeToFeed={reelsSwipeToFeed}
              onReelsSwipeToProfile={reelsSwipeToProfile}
              reelsSuppressPlayback={reelsSuppressPlayback}
            />
            {mergedVideoPosts.map((post, i) => {
            const videoUrl = getPrimaryVideoUrlForPost(post);
            if (!videoUrl) return null;
            const profilePath = buildProfilePath({
              isMe: post.authorId === user?.id,
              userId: post.authorId,
              publicId: post.author?.publicId,
              fallbackPath: "/posts",
            });
            const postPath = buildProfilePostPath({
              postId: post.id,
              linkCode: post.linkCode,
              isMe: post.authorId === user?.id,
              userId: post.authorId,
              publicId: post.author?.publicId,
              fallbackPath: "/posts",
            });
            const soundOn = soundPostId === post.id;

            const fireCount = post.reactions?.find((r) => r.emoji === DOUBLE_TAP_LIKE_EMOJI)?.count ?? 0;

            const slideH = viewportH > 0 ? viewportH : undefined;

            return (
              <div
                key={post.id}
                role="listitem"
                className="relative z-10 shrink-0 snap-start overflow-hidden pointer-events-none"
                style={
                  slideH != null
                    ? { height: slideH, minHeight: slideH }
                    : { minHeight: "min(100dvh,920px)" }
                }
              >
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-row bg-gradient-to-t from-black/80 via-black/15 to-transparent">
                  <div className="pointer-events-none flex min-w-0 flex-1 flex-col justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[4.25rem]">
                    <div className="pointer-events-auto">
                      <button
                        type="button"
                        className="flex min-h-[var(--uix-touch-min)] min-w-0 items-center gap-2 rounded-lg text-left text-white outline-none ring-offset-2 ring-offset-black focus-visible:ring-2 focus-visible:ring-white/60"
                        onClick={() => setLocation(profilePath)}
                      >
                        <UserAvatar
                          avatarUrl={post.author?.avatarUrl ?? undefined}
                          displayName={
                            post.channelName ||
                            (post.author
                              ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ")
                              : null) ||
                            `ID ${post.author?.publicId ?? post.authorId}`
                          }
                          seed={String(post.authorId)}
                          size={40}
                          className="h-10 w-10 shrink-0 rounded-full border border-white/20"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold leading-tight">
                            {post.channelName ||
                              (post.author
                                ? [post.author.displayName, post.author.surname].filter(Boolean).join(" ")
                                : null) ||
                              `ID ${post.author?.publicId ?? post.authorId}`}
                          </p>
                          <p className="text-xs text-white/70">{formatPostTime(post.createdAt)}</p>
                        </div>
                      </button>
                      {post.text?.trim() ? (
                        <p className="mt-2 line-clamp-4 text-sm text-white/90">{post.text.trim()}</p>
                      ) : null}
                      <button
                        type="button"
                        className="mt-3 flex min-h-[var(--uix-touch-min)] w-fit items-center rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-xs font-medium backdrop-blur-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLocation(postPath);
                        }}
                      >
                        Открыть пост
                      </button>
                    </div>
                  </div>

                  <div className="pointer-events-auto flex w-[3rem] shrink-0 flex-col items-center justify-end gap-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+3.25rem)] pr-[max(0.35rem,env(safe-area-inset-right))]">
                    {user ? (
                      <>
                        <TapScaleButton
                          type="button"
                          haptic={false}
                          subtle
                          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex-col items-center gap-1 text-white"
                          aria-label={post.myReaction === DOUBLE_TAP_LIKE_EMOJI ? "Убрать реакцию" : "Лайк"}
                          onClick={() => {
                            void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                              triggerLightHaptic(),
                            );
                            playLikeActionSound();
                            mutateFireReaction(post);
                          }}
                        >
                          <span className={REELS_RAIL_HIT}>
                            <Heart
                              className={cn(
                                REELS_RAIL_ICON,
                                post.myReaction === DOUBLE_TAP_LIKE_EMOJI ? "fill-rose-500 text-rose-500" : "text-white",
                              )}
                              strokeWidth={post.myReaction === DOUBLE_TAP_LIKE_EMOJI ? 0 : REELS_RAIL_STROKE}
                              aria-hidden
                            />
                          </span>
                          <span className={REELS_RAIL_COUNT}>{formatCompactCountRu(fireCount)}</span>
                        </TapScaleButton>
                        <TapScaleButton
                          type="button"
                          haptic={false}
                          subtle
                          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex-col items-center gap-1 text-white"
                          aria-label="Комментарии"
                          onClick={() => setActiveCommentPostId(post.id)}
                        >
                          <span className={REELS_RAIL_HIT}>
                            <MessageCircle
                              className={cn(REELS_RAIL_ICON, "text-white")}
                              strokeWidth={REELS_RAIL_STROKE}
                              aria-hidden
                            />
                          </span>
                          <span className={REELS_RAIL_COUNT}>
                            {formatCompactCountRu(post.commentsCount ?? 0)}
                          </span>
                        </TapScaleButton>
                        <TapScaleButton
                          type="button"
                          haptic={false}
                          subtle
                          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex-col items-center gap-1 text-white"
                          aria-label={post.isSaved ? "Убрать из сохранённого" : "Сохранить"}
                          disabled={savePostMutation.isPending && savePostMutation.variables?.postId === post.id}
                          onClick={() => {
                            void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                              triggerLightHaptic(),
                            );
                            savePostMutation.mutate({ postId: post.id, save: !post.isSaved });
                          }}
                        >
                          <span className={REELS_RAIL_HIT}>
                            <Bookmark
                              className={cn(
                                REELS_RAIL_ICON,
                                post.isSaved ? "fill-amber-300 text-amber-300" : "text-white",
                              )}
                              strokeWidth={post.isSaved ? 0 : REELS_RAIL_STROKE}
                              aria-hidden
                            />
                          </span>
                        </TapScaleButton>
                      </>
                    ) : null}
                    <TapScaleButton
                      type="button"
                      haptic={false}
                      subtle
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex-col items-center gap-1 text-white"
                      aria-label="Поделиться"
                      onClick={() => setShareSheetPost(post)}
                    >
                      <span className={REELS_RAIL_HIT}>
                        <Send
                          className={cn(REELS_RAIL_ICON, "text-white -rotate-[28deg]")}
                          strokeWidth={REELS_RAIL_STROKE}
                          aria-hidden
                        />
                      </span>
                    </TapScaleButton>
                    <TapScaleButton
                      type="button"
                      haptic={false}
                      subtle
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex-col items-center gap-1 text-white"
                      aria-label={soundOn ? "Выключить звук" : "Включить звук"}
                      onClick={() => {
                        void import("@/lib/capacitor-native").then(({ triggerLightHaptic }) =>
                          triggerLightHaptic(),
                        );
                        const nextOn = soundPostId !== post.id;
                        forceReelSoundByGesture(post.id, nextOn);
                        setSoundPostId(nextOn ? post.id : null);
                      }}
                    >
                      <span className={REELS_RAIL_HIT}>
                        {soundOn ? (
                          <Volume2
                            className={cn(REELS_RAIL_ICON, "text-white")}
                            strokeWidth={REELS_RAIL_STROKE}
                            aria-hidden
                          />
                        ) : (
                          <VolumeX
                            className={cn(REELS_RAIL_ICON, "text-white opacity-90")}
                            strokeWidth={REELS_RAIL_STROKE}
                            aria-hidden
                          />
                        )}
                      </span>
                    </TapScaleButton>
                  </div>
                </div>

                <AnimatePresence>
                  {doubleTapHeartPostId === post.id ? (
                    <motion.div
                      key={`reel-heart-${post.id}`}
                      initial={
                        reducedMotion
                          ? { opacity: 1, scale: 1, y: 0 }
                          : { opacity: 0, scale: 0.72, y: 8 }
                      }
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={
                        reducedMotion
                          ? { opacity: 0, scale: 1, y: 0 }
                          : { opacity: 0, scale: 1.06, y: -6 }
                      }
                      transition={{
                        duration: reducedMotion ? DURATION_NORMAL_S * 0.45 : DURATION_NORMAL_S * 0.85,
                        ease: EASING_OUT_BEZIER,
                      }}
                      className="pointer-events-none absolute inset-0 z-[22] flex items-center justify-center"
                      aria-hidden
                    >
                      <Heart className="h-20 w-20 fill-rose-500 text-rose-500/95 drop-shadow-[0_8px_24px_rgba(244,63,94,0.55)]" />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
          </div>
        </div>

        {isFetchingNextPage ? (
          <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
            Ещё видео…
          </div>
        ) : null}

        <CommentsModal
          isOpen={activeCommentPostId !== null}
          onClose={() => setActiveCommentPostId(null)}
          postId={activeCommentPostId}
          postAuthorId={
            activeCommentPostId
              ? mergedVideoPosts.find((p) => p.id === activeCommentPostId)?.authorId
              : activePostAuthorId
          }
        />
        <ReelsPostShareSheet
          post={shareSheetPost}
          selfUserId={user?.id}
          onClose={() => setShareSheetPost(null)}
        />
      </div>
    </FeedScrollRootContext.Provider>
  );
}
