import type { CommentItem } from "./types";

export function mapCommentDto(raw: Record<string, unknown>, fallbackPostId: string | number): CommentItem {
  const pid = raw.publicId;
  const publicId =
    typeof pid === "number" && Number.isFinite(pid)
      ? pid
      : typeof pid === "string" && /^\d+$/.test(pid)
        ? Number(pid)
        : null;
  return {
    id: String(raw.id ?? ""),
    postId: String(raw.postId ?? fallbackPostId),
    userId: typeof raw.userId === "string" ? raw.userId : undefined,
    publicId: publicId ?? undefined,
    text: String(raw.text ?? ""),
    createdAt: String(raw.createdAt ?? ""),
    user: String(raw.user ?? "Пользователь"),
    avatar: typeof raw.avatar === "string" ? raw.avatar : null,
    parentCommentId: typeof raw.parentCommentId === "string" ? raw.parentCommentId : null,
    parentAuthorName: typeof raw.parentAuthorName === "string" ? raw.parentAuthorName : null,
    parentText: typeof raw.parentText === "string" ? raw.parentText : null,
    likes: typeof raw.likes === "number" ? raw.likes : 0,
    likedByMe: raw.likedByMe === true,
  };
}

export function mapCreatedCommentDto(data: Record<string, unknown>, postId: string | number): CommentItem {
  const pid = data.publicId;
  const publicId =
    typeof pid === "number" && Number.isFinite(pid)
      ? pid
      : typeof pid === "string" && /^\d+$/.test(pid)
        ? Number(pid)
        : null;
  return {
    id: String(data.id ?? ""),
    postId: String(data.postId ?? postId),
    userId: typeof data.userId === "string" ? data.userId : undefined,
    publicId: publicId ?? undefined,
    text: String(data.text ?? ""),
    createdAt: String(data.createdAt ?? ""),
    user: String(data.user ?? "Пользователь"),
    avatar: typeof data.avatar === "string" ? data.avatar : null,
    parentCommentId: typeof data.parentCommentId === "string" ? data.parentCommentId : null,
    parentAuthorName: typeof data.parentAuthorName === "string" ? data.parentAuthorName : null,
    parentText: typeof data.parentText === "string" ? data.parentText : null,
    likes: typeof data.likes === "number" ? data.likes : 0,
    likedByMe: data.likedByMe === true,
  };
}
