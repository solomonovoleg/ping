import type { QueryClient } from "@tanstack/react-query";

export function invalidatePostCommentQueries(
  queryClient: QueryClient,
  opts: { postId: string | number | null; postAuthorId?: string | null },
): void {
  const { postId, postAuthorId } = opts;
  void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
  void queryClient.invalidateQueries({ queryKey: ["posts", "reels-feed"] });
  if (postAuthorId) void queryClient.invalidateQueries({ queryKey: ["posts", "author", postAuthorId] });
  if (postId != null) void queryClient.invalidateQueries({ queryKey: ["post", String(postId)] });
}
