import { count, inArray, sql } from "drizzle-orm";
import { FEED_LATEST_COMMENTS_PREVIEW_LIMIT } from "@shared/feed-latest-comments";
import { postCommentLikes } from "@shared/schema";
import { getDb } from "../db";

type LatestCommentRow = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: Date | string;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
};

function extractQueryRows<T>(queryResult: unknown): T[] {
  if (Array.isArray(queryResult)) return queryResult as T[];
  if (queryResult && typeof queryResult === "object") {
    const rows = (queryResult as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}

export type LatestCommentPreview = {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: string;
  user: string;
  avatar: string | null;
  likes: number;
};

export async function loadLatestCommentsByPostIds(
  postIds: string[],
): Promise<Record<string, LatestCommentPreview[]>> {
  const latestCommentsByPost: Record<string, LatestCommentPreview[]> = {};
  if (postIds.length === 0) return latestCommentsByPost;
  const db = getDb();
  const idList = sql.join(
    postIds.map((id) => sql`${id}`),
    sql`, `,
  );
  const latestCommentQuery = await db.execute(sql`
    select c.id,
           c.post_id as "postId",
           c.user_id as "userId",
           c.text,
           c.created_at as "createdAt",
           u.display_name as "displayName",
           u.surname as "surname",
           u.avatar_url as "avatarUrl"
    from (
      select pc.id,
             pc.post_id,
             pc.user_id,
             pc.text,
             pc.created_at,
             row_number() over (partition by pc.post_id order by pc.created_at desc) as rn
      from post_comments pc
      where pc.post_id in (${idList})
    ) c
    left join users u on u.id = c.user_id
    where c.rn <= ${FEED_LATEST_COMMENTS_PREVIEW_LIMIT}
    order by c.post_id asc, c.created_at desc
  `);
  const latestCommentRows = extractQueryRows<LatestCommentRow>(latestCommentQuery);
  const previewIds = latestCommentRows.map((r) => r.id).filter(Boolean);
  const likeCountById = new Map<string, number>();
  if (previewIds.length > 0) {
    try {
      const counts = await db
        .select({ commentId: postCommentLikes.commentId, n: count() })
        .from(postCommentLikes)
        .where(inArray(postCommentLikes.commentId, previewIds))
        .groupBy(postCommentLikes.commentId);
      for (const row of counts) likeCountById.set(row.commentId, Number(row.n));
    } catch {
      /* таблица лайков может отсутствовать до миграции */
    }
  }
  latestCommentRows.forEach((r) => {
    if (!latestCommentsByPost[r.postId]) latestCommentsByPost[r.postId] = [];
    latestCommentsByPost[r.postId].push({
      id: r.id,
      postId: r.postId,
      userId: r.userId,
      text: r.text,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      user: [r.displayName, r.surname].filter(Boolean).join(" ") || "Пользователь",
      avatar: r.avatarUrl ?? null,
      likes: likeCountById.get(r.id) ?? 0,
    });
  });
  return latestCommentsByPost;
}
