import { posts, users } from "@shared/schema";
import type { PostMediaLayout } from "@shared/post-media-layout";

/** Строка поста в глобальной публичной ленте (JOIN `users`), одна схема для feed-worker, snapshot и постов. */
export type GlobalPublicFeedRow = {
  id: string;
  linkCode: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  mediaUrls: string[] | null;
  mediaLayout: PostMediaLayout | null;
  hashtags: string[] | null;
  isDraft: boolean;
  visibility: string;
  edgeId: string | null;
  edgeDisplayAudience: string | null;
  linkEmbedEnabled: boolean;
  createdAt: Date;
  authorDisplayName: string | null;
  authorSurname: string | null;
  authorAvatarUrl: string | null;
  authorPublicId: number;
};

export const globalPublicFeedSelectFields = {
  id: posts.id,
  linkCode: posts.linkCode,
  authorId: posts.authorId,
  text: posts.text,
  imageUrl: posts.imageUrl,
  mediaUrls: posts.mediaUrls,
  mediaLayout: posts.mediaLayout,
  hashtags: posts.hashtags,
  isDraft: posts.isDraft,
  visibility: posts.visibility,
  edgeId: posts.edgeId,
  edgeDisplayAudience: posts.edgeDisplayAudience,
  linkEmbedEnabled: posts.linkEmbedEnabled,
  createdAt: posts.createdAt,
  authorDisplayName: users.displayName,
  authorSurname: users.surname,
  authorAvatarUrl: users.avatarUrl,
  authorPublicId: users.publicId,
};
