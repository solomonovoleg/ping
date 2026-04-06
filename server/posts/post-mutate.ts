import { and, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { extractHashtags, posts, users } from "@shared/schema";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { pushEdgeDisplayAudienceToCreatorUpstream } from "./edge-display-audience";
import { normalizePostMediaPublic } from "./normalize-post-media";
import { PostsServiceError } from "./posts-service-error";
import { schedulePostContentInterestsClassification } from "./classify-post-content-interests";
import { resolveCanonicalPostId } from "./resolve-post-ref";

export async function deleteOwnPost(postRef: string, userId: string): Promise<void> {
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  if (existing.authorId !== userId) {
    throw new PostsServiceError(403, "Можно удалить только свой пост");
  }
  await db
    .update(users)
    .set({ pinnedPostId: null })
    .where(and(eq(users.id, userId), eq(users.pinnedPostId, postId)));
  await db.delete(posts).where(eq(posts.id, postId));
}

export type UpdatePostInput = {
  postId: string;
  userId: string;
  text?: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  mediaLayout?: PostMediaLayout | null;
  isDraft?: boolean;
  visibility?: "public" | "followers";
  /** Только если у поста есть кампания EDGE (`edge_id`). */
  edgeDisplayAudience?: "self" | "followers" | "public";
  linkEmbedEnabled?: boolean;
};

export async function updateOwnPost(input: UpdatePostInput) {
  const {
    postId: postRef,
    userId,
    text,
    imageUrl,
    mediaUrls,
    mediaLayout,
    isDraft,
    visibility,
    edgeDisplayAudience,
    linkEmbedEnabled,
  } = input;
  const postId = await resolveCanonicalPostId(postRef);
  if (!postId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  const [existing] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!existing) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  if (existing.authorId !== userId) {
    throw new PostsServiceError(403, "Можно редактировать только свой пост");
  }
  const wasDraft = existing.isDraft === true;
  const updates: {
    text?: string;
    imageUrl?: string | null;
    mediaUrls?: string[] | null | SQL;
    mediaLayout?: PostMediaLayout | null;
    hashtags?: string[] | null;
    isDraft?: boolean;
    visibility?: string;
    linkEmbedEnabled?: boolean;
  } = {};
  let pushedEdgeAudience = false;
  if (edgeDisplayAudience !== undefined) {
    const eid = typeof existing.edgeId === "string" ? existing.edgeId.trim() : "";
    if (!eid) {
      throw new PostsServiceError(400, "Аудиторию EDGE можно менять только у поста с кампанией");
    }
    const push = await pushEdgeDisplayAudienceToCreatorUpstream(eid, userId, edgeDisplayAudience);
    if (!push.ok) {
      throw new PostsServiceError(push.status, push.message);
    }
    pushedEdgeAudience = true;
  }
  if (text !== undefined) {
    updates.text = text;
    const tags = extractHashtags(text);
    updates.hashtags = tags.length > 0 ? tags : null;
  }
  if (typeof isDraft === "boolean") updates.isDraft = isDraft;
  if (visibility === "public" || visibility === "followers") updates.visibility = visibility;
  if (typeof linkEmbedEnabled === "boolean") updates.linkEmbedEnabled = linkEmbedEnabled;
  if (mediaLayout !== undefined) updates.mediaLayout = mediaLayout;
  if (mediaUrls !== undefined) {
    if (mediaUrls.length === 0) {
      updates.imageUrl = null;
      updates.mediaUrls = sql`NULL`;
    } else {
      updates.imageUrl = mediaUrls[0];
      updates.mediaUrls = mediaUrls;
    }
  } else if (imageUrl !== undefined) {
    updates.imageUrl = imageUrl;
    updates.mediaUrls = imageUrl ? [imageUrl] : sql`NULL`;
  }
  if (Object.keys(updates).length === 0) {
    const rowForReturn = pushedEdgeAudience
      ? (await db.select().from(posts).where(eq(posts.id, postId)).limit(1))[0] ?? existing
      : existing;
    const { imageUrl: outImg, mediaUrls: urls } = normalizePostMediaPublic(rowForReturn.imageUrl, rowForReturn.mediaUrls);
    return {
      id: rowForReturn.id,
      linkCode: rowForReturn.linkCode,
      text: rowForReturn.text,
      imageUrl: outImg,
      mediaUrls: urls,
      mediaLayout: (rowForReturn.mediaLayout as PostMediaLayout | null) ?? null,
      linkEmbedEnabled: rowForReturn.linkEmbedEnabled !== false,
      createdAt: rowForReturn.createdAt?.toISOString?.(),
    };
  }
  const [row] = await db.update(posts).set(updates).where(eq(posts.id, postId)).returning();
  if (!row) {
    throw new PostsServiceError(500, "Не удалось обновить пост");
  }
  const publishedNow = wasDraft && typeof isDraft === "boolean" && !isDraft;
  if (!row.isDraft && (updates.text !== undefined || publishedNow)) {
    schedulePostContentInterestsClassification(row.id);
  }
  if (publishedNow) {
    void import("../edge-money-post-created/handle-post-created-for-edge-money")
      .then((m) => m.handlePostCreatedForEdgeMoney({ userId }))
      .catch((e) => console.error("[edge-money-post-created]", e));
  }
  const { imageUrl: outImg, mediaUrls: urls } = normalizePostMediaPublic(row.imageUrl, row.mediaUrls);
  return {
    id: row.id,
    linkCode: row.linkCode,
    text: row.text,
    imageUrl: outImg,
    mediaUrls: urls,
    mediaLayout: (row.mediaLayout as PostMediaLayout | null) ?? null,
    linkEmbedEnabled: row.linkEmbedEnabled !== false,
    createdAt: row.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}
