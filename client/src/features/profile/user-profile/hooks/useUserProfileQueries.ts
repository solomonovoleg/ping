import { useQuery } from "@tanstack/react-query";
import { fetchUserProfile, type PublicProfile } from "@/lib/users";
import { fetchPostsByAuthor, fetchSavedPosts, type FeedPost } from "@/lib/posts";
import { fetchStoriesByUser, fetchStoryViewers, type StoryItem } from "@/lib/stories";

export function useUserProfileQueries(args: {
  authorId?: string;
  isMe: boolean;
  userId?: string;
  activeViewersStoryId: string | null;
}) {
  const {
    data: queryPosts = [],
    isFetching: postsFetching,
    isError: postsError,
    error: postsErrorDetail,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ["posts", "author", args.authorId],
    queryFn: () => fetchPostsByAuthor(args.authorId!, 50),
    enabled: !!args.authorId && args.isMe,
    staleTime: 45_000,
  });

  const { data: myProfileStats } = useQuery({
    queryKey: ["profile", "me", args.userId],
    queryFn: () => fetchUserProfile(args.userId!),
    enabled: args.isMe && !!args.userId,
  });

  const { data: queryStories = [], refetch: refetchStories } = useQuery({
    queryKey: ["stories", args.authorId],
    queryFn: () => fetchStoriesByUser(args.authorId!),
    enabled: !!args.authorId && args.isMe,
  });

  const { data: savedPostsForCommentLookup = [] } = useQuery({
    queryKey: ["posts", "saved", args.userId],
    queryFn: () => fetchSavedPosts(50),
    enabled: Boolean(args.isMe && args.userId),
    staleTime: 60_000,
  });

  const { data: activeStoryViewers = [], isLoading: activeStoryViewersLoading } = useQuery({
    queryKey: ["stories", "viewers", args.activeViewersStoryId],
    queryFn: () => fetchStoryViewers(args.activeViewersStoryId!),
    enabled: !!args.activeViewersStoryId && args.isMe,
  });

  return {
    queryPosts: queryPosts as FeedPost[],
    postsFetching,
    postsError,
    postsErrorDetail,
    refetchPosts,
    myProfileStats: myProfileStats as PublicProfile | undefined,
    queryStories: queryStories as StoryItem[],
    refetchStories,
    savedPostsForCommentLookup: savedPostsForCommentLookup as FeedPost[],
    activeStoryViewers,
    activeStoryViewersLoading,
  };
}
