import { sql } from "drizzle-orm";
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
    where c.rn <= 2
    order by c.post_id asc, c.created_at desc
  `);
  const latestCommentRows = extractQueryRows<LatestCommentRow>(latestCommentQuery);
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
      likes: 0,
    });
  });
  return latestCommentsByPost;
}
