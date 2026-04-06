import { and, count, desc, eq, inArray } from "drizzle-orm";
import { postCommentLikes, postComments, users } from "@shared/schema";
import type { getDb } from "../../../db";

type Db = ReturnType<typeof getDb>;

export async function queryCommentsListForPost(db: Db, postId: string, viewerId: string | null) {
  const rows = await db
    .select({
      id: postComments.id,
      postId: postComments.postId,
      userId: postComments.userId,
      text: postComments.text,
      createdAt: postComments.createdAt,
      parentCommentId: postComments.parentCommentId,
      displayName: users.displayName,
      surname: users.surname,
      avatarUrl: users.avatarUrl,
      publicId: users.publicId,
    })
    .from(postComments)
    .leftJoin(users, eq(postComments.userId, users.id))
    .where(eq(postComments.postId, postId))
    .orderBy(desc(postComments.createdAt))
    .limit(500);

  const parentIds = [
    ...new Set(rows.map((r) => r.parentCommentId).filter((id): id is string => typeof id === "string" && id.length > 0)),
  ];
  const parentNameById = new Map<string, string | null>();
  const parentTextById = new Map<string, string | null>();
  if (parentIds.length > 0) {
    const parentRows = await db
      .select({
        id: postComments.id,
        dn: users.displayName,
        sn: users.surname,
        text: postComments.text,
      })
      .from(postComments)
      .leftJoin(users, eq(postComments.userId, users.id))
      .where(inArray(postComments.id, parentIds));
    for (const pr of parentRows) {
      parentNameById.set(pr.id, [pr.dn, pr.sn].filter(Boolean).join(" ") || "Пользователь");
      parentTextById.set(pr.id, typeof pr.text === "string" ? pr.text.slice(0, 180) : null);
    }
  }

  const ids = rows.map((r) => r.id);
  const likeCountById = new Map<string, number>();
  const likedByViewer = new Set<string>();
  if (ids.length > 0) {
    const counts = await db
      .select({ commentId: postCommentLikes.commentId, n: count() })
      .from(postCommentLikes)
      .where(inArray(postCommentLikes.commentId, ids))
      .groupBy(postCommentLikes.commentId);
    for (const c of counts) likeCountById.set(c.commentId, Number(c.n));
    if (viewerId) {
      const likedRows = await db
        .select({ commentId: postCommentLikes.commentId })
        .from(postCommentLikes)
        .where(and(inArray(postCommentLikes.commentId, ids), eq(postCommentLikes.userId, viewerId)));
      for (const lr of likedRows) likedByViewer.add(lr.commentId);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    userId: r.userId,
    publicId: r.publicId ?? null,
    text: r.text,
    createdAt: r.createdAt?.toISOString?.() ?? r.createdAt,
    user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
    avatar: r.avatarUrl ?? null,
    parentCommentId: r.parentCommentId ?? null,
    parentAuthorName:
      r.parentCommentId != null ? (parentNameById.get(r.parentCommentId) ?? null) : null,
    parentText:
      r.parentCommentId != null ? (parentTextById.get(r.parentCommentId) ?? null) : null,
    likes: likeCountById.get(r.id) ?? 0,
    likedByMe: viewerId ? likedByViewer.has(r.id) : false,
  }));
}
