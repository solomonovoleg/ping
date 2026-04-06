import { flushSync } from "react-dom";
import { fetchProfilePage, type PublicProfile } from "@/lib/users";
import type { FeedPost } from "@/lib/posts";
import type { StoryItem } from "@/lib/stories";
import { parseProfilePagePayload } from "../model/parse-profile-page";

export type OtherProfilePageData = {
  profile: PublicProfile;
  posts: FeedPost[];
  stories: StoryItem[];
};

export async function fetchOtherProfilePage(routeId: string): Promise<OtherProfilePageData | null> {
  const data = await fetchProfilePage(routeId, 50);
  return parseProfilePagePayload(data);
}

export function applyOtherProfilePageData(
  parsed: OtherProfilePageData,
  setters: {
    setApiProfile: (value: PublicProfile | null) => void;
    setPagePosts: (value: FeedPost[]) => void;
    setPageStories: (value: StoryItem[]) => void;
  },
): void {
  flushSync(() => {
    setters.setApiProfile(parsed.profile);
    setters.setPagePosts(parsed.posts);
    setters.setPageStories(parsed.stories);
  });
}
