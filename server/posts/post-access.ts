import { eq, or } from "drizzle-orm";
import { posts } from "@shared/schema";
import { getDb } from "../db";
import { storage } from "../storage";
import { normalizeEdgeDisplayAudience } from "./edge-display-audience";
import { PostsServiceError } from "./posts-service-error";

export type PostAccessRow = {
  authorId: string;
  visibility: string | null;
  isDraft: boolean;
  edgeId?: string | null;
  edgeDisplayAudience?: string | null;
};

/** 404, чтобы не подтверждать существование приватного поста по UUID. */
export async function ensurePostReadableByViewer(
  row: PostAccessRow,
  viewerId: string | null,
): Promise<void> {
  if (row.isDraft) {
    if (!viewerId || viewerId !== row.authorId) {
      throw new PostsServiceError(404, "Пост не найден");
    }
    return;
  }
  const vis = (row.visibility ?? "public").toLowerCase();
  if (vis === "public") {
    await ensureEdgePostReadable(row, viewerId);
    return;
  }
  if (vis === "followers") {
    if (viewerId === row.authorId) {
      await ensureEdgePostReadable(row, viewerId);
      return;
    }
    if (!viewerId) throw new PostsServiceError(404, "Пост не найден");
    const ok = await storage.isFollowing(viewerId, row.authorId);
    if (!ok) throw new PostsServiceError(404, "Пост не найден");
    await ensureEdgePostReadable(row, viewerId);
    return;
  }
  if (!viewerId || viewerId !== row.authorId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  await ensureEdgePostReadable(row, viewerId);
}

async function ensureEdgePostReadable(row: PostAccessRow, viewerId: string | null): Promise<void> {
  const eid = row.edgeId?.trim();
  if (!eid) return;
  const aud = normalizeEdgeDisplayAudience(row.edgeDisplayAudience);
  if (aud === "public") return;
  if (!viewerId) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  if (viewerId === row.authorId) return;
  if (aud === "self") {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const ok = await storage.isFollowing(viewerId, row.authorId);
  if (!ok) {
    throw new PostsServiceError(404, "Пост не найден");
  }
}

export async function assertPostReadableByViewer(postRef: string, viewerId: string | null): Promise<void> {
  const ref = postRef.trim();
  if (!ref) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  const db = getDb();
  const [row] = await db
    .select({
      authorId: posts.authorId,
      visibility: posts.visibility,
      isDraft: posts.isDraft,
      edgeId: posts.edgeId,
      edgeDisplayAudience: posts.edgeDisplayAudience,
    })
    .from(posts)
    .where(or(eq(posts.id, ref), eq(posts.linkCode, ref)))
    .limit(1);
  if (!row) {
    throw new PostsServiceError(404, "Пост не найден");
  }
  await ensurePostReadableByViewer(row, viewerId);
}
