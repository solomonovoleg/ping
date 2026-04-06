import type { PostMediaLayout } from "@shared/post-media-layout";
import { normalizeEdgeDisplayAudience } from "./edge-display-audience";

/** Поля автора из JOIN `posts` + `users` в ответах ленты / деталки / сохранённых. */
export type PostAuthorJoinRow = {
  authorId: string;
  authorPublicId: number;
  authorDisplayName: string | null;
  authorSurname: string | null;
  authorAvatarUrl: string | null;
};

export function postAuthorFromJoinRow(row: PostAuthorJoinRow) {
  return {
    id: row.authorId,
    publicId: row.authorPublicId,
    displayName: row.authorDisplayName ?? null,
    surname: row.authorSurname ?? null,
    avatarUrl: row.authorAvatarUrl ?? null,
  };
}

export function postChannelNameFromJoinRow(row: PostAuthorJoinRow): string {
  return [row.authorDisplayName, row.authorSurname].filter(Boolean).join(" ") || `ID ${row.authorPublicId}`;
}

export function postHashtagsPublic(hashtags: unknown): string[] {
  if (hashtags && Array.isArray(hashtags)) return hashtags as string[];
  return [];
}

export function postVisibilityPublic(visibility: string | null | undefined): "followers" | "public" {
  return (visibility ?? "public").toLowerCase() === "followers" ? "followers" : "public";
}

export function postEdgeDisplayAudiencePublic(
  edgeId: string | null | undefined,
  edgeDisplayAudience: string | null | undefined,
): ReturnType<typeof normalizeEdgeDisplayAudience> | null {
  return edgeId ? normalizeEdgeDisplayAudience(edgeDisplayAudience) : null;
}

export function postMediaLayoutPublic(raw: unknown): PostMediaLayout | null {
  return (raw as PostMediaLayout | null) ?? null;
}
