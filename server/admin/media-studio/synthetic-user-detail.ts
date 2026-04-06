import { and, desc, eq, sql } from "drizzle-orm";
import type { User } from "@shared/schema";
import { posts, profilePageViews } from "@shared/schema";
import { getDb } from "../../db";

export type StudioSyntheticPostRow = {
  id: string;
  text: string;
  createdAt: Date;
  imageUrl: string | null;
};

export async function loadStudioSyntheticUserDetail(user: User): Promise<{
  profileViewsTotal: number;
  profileViewsUniqueViewers: number;
  postsCount: number;
  recentPosts: StudioSyntheticPostRow[];
}> {
  const db = getDb();
  const uid = user.id;
  const [tv] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(profilePageViews)
    .where(eq(profilePageViews.profileUserId, uid));
  const [uv] = await db
    .select({ c: sql<number>`count(distinct ${profilePageViews.viewerUserId})::int` })
    .from(profilePageViews)
    .where(eq(profilePageViews.profileUserId, uid));
  const [pc] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, uid), eq(posts.isDraft, false)));
  const recentPosts = await db
    .select({
      id: posts.id,
      text: posts.text,
      createdAt: posts.createdAt,
      imageUrl: posts.imageUrl,
    })
    .from(posts)
    .where(and(eq(posts.authorId, uid), eq(posts.isDraft, false)))
    .orderBy(desc(posts.createdAt))
    .limit(40);
  return {
    profileViewsTotal: Number(tv?.c ?? 0),
    profileViewsUniqueViewers: Number(uv?.c ?? 0),
    postsCount: Number(pc?.c ?? 0),
    recentPosts,
  };
}
