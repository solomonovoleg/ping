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
  if (options.isMe) return "/profile/me";
  const id = pickProfileRouteId(options.publicId, options.userId);
  return id ? `/profile/${encodeURIComponent(id)}` : fallbackPath;
}

export function buildProfilePostPath(options: {
  postId: unknown;
  isMe?: boolean;
  publicId?: unknown;
  userId?: unknown;
  fallbackPath?: string;
}): string {
  const postId = normalizeRouteToken(options.postId);
  if (!postId) return options.fallbackPath ?? "/posts";
  const profilePath = buildProfilePath(options);
  if (!profilePath.startsWith("/profile/")) return profilePath;
  return `${profilePath}/post/${encodeURIComponent(postId)}`;
}

