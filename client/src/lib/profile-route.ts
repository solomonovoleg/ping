function normalizeRouteToken(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  if (lowered === "undefined" || lowered === "null" || lowered === "nan") return null;
  return raw;
}

export function pickProfileRouteId(publicId?: unknown, userId?: unknown): string | null {
  const publicToken = normalizeRouteToken(publicId);
  if (publicToken) return publicToken;
  return normalizeRouteToken(userId);
}

export function buildProfilePath(options: {
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
  fallbackPath?: string;
}): string {
  const fallbackPath = options.fallbackPath ?? "/posts";
  if (options.isMe) return "/u/me";
  const id = pickProfileRouteId(options.publicId, options.userId);
  return id ? `/u/${encodeURIComponent(id)}` : fallbackPath;
}

/** Сегмент пути `/p/…`: короткий `linkCode` с API или fallback на UUID. */
export function postUrlSegment(linkCode: unknown, postId: unknown): string {
  const code = normalizeRouteToken(linkCode);
  if (code) return code;
  return normalizeRouteToken(postId) ?? "";
}

export function buildProfilePostPath(options: {
  postId: unknown;
  /** Короткий публичный код поста (`link_code`); если есть — попадает в URL вместо UUID. */
  linkCode?: unknown;
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
  fallbackPath?: string;
  /** Открыть комментарии и подсветить комментарий (см. PostDetail: ?commentId=). */
  commentId?: unknown;
}): string {
  const seg = postUrlSegment(options.linkCode, options.postId);
  if (!seg) return options.fallbackPath ?? "/posts";
  const profilePath = buildProfilePath(options);
  if (!profilePath.startsWith("/u/")) return profilePath;
  const base = `${profilePath}/p/${encodeURIComponent(seg)}`;
  const commentId = normalizeRouteToken(options.commentId);
  if (!commentId) return base;
  return `${base}?commentId=${encodeURIComponent(commentId)}`;
}

/** Диплинк в вертикальные рилсы (тот же сегмент профиля, что и у поста). Старый `?post=` остаётся запасным вариантом. */
export function buildReelsPostPath(options: {
  postId: unknown;
  linkCode?: unknown;
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
}): string {
  const seg = postUrlSegment(options.linkCode, options.postId);
  if (!seg) return "/reels";
  const profilePath = buildProfilePath(options);
  if (!profilePath.startsWith("/u/")) {
    const q = new URLSearchParams();
    q.set("post", seg);
    return `/reels?${q.toString()}`;
  }
  return `/reels${profilePath}/p/${encodeURIComponent(seg)}`;
}

export function buildProfileFollowersPath(options: {
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
  fallbackPath?: string;
}): string {
  const profilePath = buildProfilePath(options);
  if (!profilePath.startsWith("/u/")) return profilePath;
  return `${profilePath}/followers`;
}

/** Диплинк в ленту: открыть сториз по id (см. Posts.tsx — storyId + storyAuthorId). */
export function buildStoriesFeedDeepLink(options: { storyId: string; storyAuthorId: string }): string {
  const sid = normalizeRouteToken(options.storyId);
  const aid = normalizeRouteToken(options.storyAuthorId);
  if (!sid || !aid) return "/posts";
  return `/posts?storyId=${encodeURIComponent(sid)}&storyAuthorId=${encodeURIComponent(aid)}`;
}

export function buildProfileFollowingPath(options: {
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
  fallbackPath?: string;
}): string {
  const profilePath = buildProfilePath(options);
  if (!profilePath.startsWith("/u/")) return profilePath;
  return `${profilePath}/following`;
}

