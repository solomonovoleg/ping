import { useMemo } from "react";
import type { FeedPost } from "@/lib/posts";
import { firstPostMediaUrl, isVideoMediaUrl } from "../utils/post-media";

export function useUserProfileDerivedPosts(args: {
  isMe: boolean;
  queryPosts: FeedPost[];
  pagePosts: FeedPost[];
  profilePinnedPostId: string | null;
  savedPostsForCommentLookup: FeedPost[];
}) {
  const profilePostsRaw = args.isMe ? args.queryPosts : args.pagePosts;

  const profilePosts = useMemo(() => {
    const pid = args.profilePinnedPostId;
    const list = profilePostsRaw;
    if (!pid) return list;
    const i = list.findIndex((p) => p.id === pid);
    if (i <= 0) return list;
    const next = [...list];
    const [pinned] = next.splice(i, 1);
    return [pinned, ...next];
  }, [args.profilePinnedPostId, profilePostsRaw]);

  const profilePinnedPreview = useMemo(() => {
    const pid = args.profilePinnedPostId;
    if (!pid) return null;
    const post = profilePostsRaw.find((p) => p.id === pid);
    if (!post) return { url: null as string | null, isVideo: false };
    const url = firstPostMediaUrl(post);
    return { url, isVideo: !!(url && isVideoMediaUrl(url)) };
  }, [args.profilePinnedPostId, profilePostsRaw]);

  const postsForCommentLookup = useMemo(() => {
    const map = new Map<string, FeedPost>();
    for (const post of profilePosts) map.set(post.id, post);
    for (const saved of args.savedPostsForCommentLookup) {
      if (!map.has(saved.id)) map.set(saved.id, saved);
    }
    return Array.from(map.values());
  }, [args.savedPostsForCommentLookup, profilePosts]);

  return {
    profilePostsRaw,
    profilePosts,
    profilePinnedPreview,
    postsForCommentLookup,
  };
}
