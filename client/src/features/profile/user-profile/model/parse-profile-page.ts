import type { FeedPost } from "@/lib/posts";
import type { PublicProfile } from "@/lib/users";
import type { StoryItem } from "@/lib/stories";

/** Единый разбор ответа `fetchProfilePage` — без дублирования в эффекте и pull-to-refresh. */
export function parseProfilePagePayload(data: unknown): {
  profile: PublicProfile;
  posts: FeedPost[];
  stories: StoryItem[];
} | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { profile?: PublicProfile; posts?: unknown; stories?: unknown };
  if (!d.profile) return null;
  const posts = Array.isArray(d.posts)
    ? d.posts.filter((p): p is FeedPost => p != null && typeof (p as FeedPost).id === "string")
    : [];
  const stories = Array.isArray(d.stories)
    ? d.stories.filter((s): s is StoryItem => s != null && typeof (s as { id?: string }).id === "string")
    : [];
  return { profile: d.profile, posts, stories };
}
