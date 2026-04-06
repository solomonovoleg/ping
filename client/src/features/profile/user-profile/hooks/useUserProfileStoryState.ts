import { useEffect, useMemo, useState } from "react";
import type { StoryItem } from "@/lib/stories";

export function useUserProfileStoryState(args: {
  isMe: boolean;
  queryStories: StoryItem[];
  pageStories: StoryItem[];
}) {
  const apiStories = useMemo(
    () => (args.isMe ? args.queryStories : args.pageStories),
    [args.isMe, args.pageStories, args.queryStories],
  );
  const hasStories = apiStories.length > 0;

  const storyViewersCountById = useMemo(
    () =>
      apiStories.reduce<Record<string, number>>((acc, story) => {
        acc[story.id] = Number((story as { viewsCount?: number }).viewsCount ?? 0);
        return acc;
      }, {}),
    [apiStories],
  );

  const [likedStoryIds, setLikedStoryIds] = useState<Record<string, boolean>>({});
  const [likesCountByStoryId, setLikesCountByStoryId] = useState<Record<string, number>>({});

  useEffect(() => {
    const nextLiked: Record<string, boolean> = {};
    const nextLikesCount: Record<string, number> = {};
    for (const story of apiStories) {
      nextLiked[story.id] = story.isLiked === true;
      nextLikesCount[story.id] = Number(story.likesCount ?? 0);
    }
    setLikedStoryIds(nextLiked);
    setLikesCountByStoryId(nextLikesCount);
  }, [apiStories]);

  return {
    apiStories,
    hasStories,
    storyViewersCountById,
    likedStoryIds,
    setLikedStoryIds,
    likesCountByStoryId,
    setLikesCountByStoryId,
  };
}
