import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import { FeedInlineVideo, type FeedReelsInteraction } from "@/components/FeedInlineVideo";
import { getPrimaryVideoUrlForPost, getReelPosterUrlForPost } from "@/lib/feed-video-post";
import { reelsVideoPreloadLevel } from "@/lib/reels-video";
import type { FeedPost } from "@/lib/posts";

const POOL_SLOT_COUNT = 3;

type ReelsVideoPoolLayerProps = {
  posts: FeedPost[];
  activeIndex: number;
  viewportH: number;
  soundPostId: string | null;
  onReelProgress: (ratio: number) => void;
  reelInteractionForPost: (post: FeedPost) => FeedReelsInteraction | null;
  onReelsSwipeToFeed?: () => void;
  onReelsSwipeToProfile?: () => void;
  /** Комментарии / шаринг открыты — пауза воспроизведения. */
  reelsSuppressPlayback?: boolean;
};

/**
 * Три стабильных плеера (как у крупных рилс): при свайпе меняется только `src` и позиция слота,
 * без mount/unmount `<video>` на каждый пост.
 */
export function ReelsVideoPoolLayer({
  posts,
  activeIndex,
  viewportH,
  soundPostId,
  onReelProgress,
  reelInteractionForPost,
  onReelsSwipeToFeed,
  onReelsSwipeToProfile,
  reelsSuppressPlayback = false,
}: ReelsVideoPoolLayerProps) {
  const n = posts.length;
  const H = viewportH;
  if (n === 0 || H <= 0) return null;

  /** Центр пула по активному слайду: `floorIdx` из скролла обновляется в rAF и может отставать — иначе кадр без `<video>` (чёрный экран). */
  const focusIdx = activeIndex;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-0 w-full"
      style={{ height: n * H }}
      aria-hidden
    >
      {Array.from({ length: POOL_SLOT_COUNT }, (_, slot) => {
        const postIndex = focusIdx - 1 + slot;
        if (postIndex < 0 || postIndex >= n) return null;

        const post = posts[postIndex];
        const videoUrl = getPrimaryVideoUrlForPost(post);
        if (!videoUrl) return null;

        const abs = resolveUrl(videoUrl);
        const posterRaw = getReelPosterUrlForPost(post);
        const posterAbs = posterRaw ? resolveUrl(posterRaw) : null;
        const isActive = activeIndex === postIndex;
        const soundOn = soundPostId === post.id;
        const reelsPreload = reelsVideoPreloadLevel(postIndex, activeIndex);
        const interaction = reelInteractionForPost(post);

        return (
          <div
            key={`reels-pool-slot-${slot}`}
            className="absolute left-0 right-0 overflow-hidden bg-neutral-950"
            style={{ top: postIndex * H, height: H, width: "100%" }}
          >
            <div
              className={cn(
                "h-full min-h-0 w-full min-w-0",
                isActive ? "pointer-events-auto touch-manipulation" : "pointer-events-none",
              )}
            >
              <FeedInlineVideo
                src={abs}
                reelPostId={post.id}
                reelPosterUrl={posterAbs}
                className="h-full w-full object-cover"
                soundOn={soundOn}
                feedReelsInteraction={interaction}
                seamlessLoop
                variant="reels"
                reelsActive={isActive}
                onReelsProgress={isActive ? onReelProgress : undefined}
                reelsPreloadLevel={reelsPreload}
                reelsStableSlot
                reelsSwipeToFeed={isActive ? onReelsSwipeToFeed : undefined}
                reelsSwipeToProfile={isActive ? onReelsSwipeToProfile : undefined}
                reelsSuppressPlayback={reelsSuppressPlayback}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
