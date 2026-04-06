export function buildAuthorPostDeepLink(params: {
  authorPublicId: number | null;
  authorId: string;
  postLinkCode: string | null;
  postId: string;
}): string {
  const postSeg = (params.postLinkCode || params.postId).trim();
  const authorSeg =
    params.authorPublicId != null ? String(params.authorPublicId) : encodeURIComponent(params.authorId);
  return `/u/${encodeURIComponent(authorSeg)}/p/${encodeURIComponent(postSeg)}`;
}
