import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  follows,
  postComments,
  postReactions,
  posts,
  postShares,
  postViews,
  profilePageViews,
  stories,
  storyViews,
} from "@shared/schema";

export async function recordProfilePageView(viewerUserId: string, profileUserId: string): Promise<void> {
  if (!viewerUserId || !profileUserId || viewerUserId === profileUserId) return;
  const db = getDb();
  try {
    await db.insert(profilePageViews).values({ profileUserId, viewerUserId });
  } catch (e) {
    console.error("[profile-analytics] recordProfilePageView", e);
  }
}

export type MyProfileAnalytics = {
  profileVisits: {
    total: number;
    uniqueVisitors: number;
    todayTotal: number;
    todayUnique: number;
  };
  /** Строки post_views по вашим постам (один зритель на пост = одна строка; один человек на 3 поста = 3). */
  postViews: { totalRecords: number; uniqueViewers: number };
  /** Строки story_views по вашим сторис (аналогично). */
  storyViews: { totalRecords: number; uniqueViewers: number };
  newFollowers: { today: number; last7Days: number };
  activityOnMyPosts: {
    reactionsLast7Days: number;
    commentsLast7Days: number;
    sharesLast7Days: number;
  };
};

export async function getMyProfileAnalytics(ownerUserId: string): Promise<MyProfileAnalytics> {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const empty: MyProfileAnalytics = {
    profileVisits: { total: 0, uniqueVisitors: 0, todayTotal: 0, todayUnique: 0 },
    postViews: { totalRecords: 0, uniqueViewers: 0 },
    storyViews: { totalRecords: 0, uniqueViewers: 0 },
    newFollowers: { today: 0, last7Days: 0 },
    activityOnMyPosts: { reactionsLast7Days: 0, commentsLast7Days: 0, sharesLast7Days: 0 },
  };

  try {
    const [
      profileTotalRow,
      profileUniqueRow,
      profileTodayTotalRow,
      profileTodayUniqueRow,
      postViewsAgg,
      storyViewsAgg,
      followersTodayRow,
      followers7dRow,
      react7dRow,
      comments7dRow,
      shares7dRow,
    ] = await Promise.all([
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(profilePageViews)
        .where(eq(profilePageViews.profileUserId, ownerUserId)),
      db
        .select({ c: sql<number>`count(distinct ${profilePageViews.viewerUserId})::int` })
        .from(profilePageViews)
        .where(eq(profilePageViews.profileUserId, ownerUserId)),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(profilePageViews)
        .where(
          and(
            eq(profilePageViews.profileUserId, ownerUserId),
            sql`${profilePageViews.viewedAt} >= date_trunc('day', now())`,
          ),
        ),
      db
        .select({ c: sql<number>`count(distinct ${profilePageViews.viewerUserId})::int` })
        .from(profilePageViews)
        .where(
          and(
            eq(profilePageViews.profileUserId, ownerUserId),
            sql`${profilePageViews.viewedAt} >= date_trunc('day', now())`,
          ),
        ),
      db
        .select({
          totalRecords: sql<number>`count(*)::int`,
          uniqueViewers: sql<number>`count(distinct ${postViews.userId})::int`,
        })
        .from(postViews)
        .innerJoin(posts, eq(postViews.postId, posts.id))
        .where(eq(posts.authorId, ownerUserId)),
      db
        .select({
          totalRecords: sql<number>`count(*)::int`,
          uniqueViewers: sql<number>`count(distinct ${storyViews.userId})::int`,
        })
        .from(storyViews)
        .innerJoin(stories, eq(storyViews.storyId, stories.id))
        .where(eq(stories.authorId, ownerUserId)),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(follows)
        .where(
          and(eq(follows.followingId, ownerUserId), sql`${follows.createdAt} >= date_trunc('day', now())`),
        ),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(follows)
        .where(and(eq(follows.followingId, ownerUserId), gte(follows.createdAt, sevenDaysAgo))),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(postReactions)
        .innerJoin(posts, eq(postReactions.postId, posts.id))
        .where(and(eq(posts.authorId, ownerUserId), gte(postReactions.createdAt, sevenDaysAgo))),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(postComments)
        .innerJoin(posts, eq(postComments.postId, posts.id))
        .where(and(eq(posts.authorId, ownerUserId), gte(postComments.createdAt, sevenDaysAgo))),
      db
        .select({ c: sql<number>`count(*)::int` })
        .from(postShares)
        .innerJoin(posts, eq(postShares.postId, posts.id))
        .where(and(eq(posts.authorId, ownerUserId), gte(postShares.createdAt, sevenDaysAgo))),
    ]);

    const pv = postViewsAgg[0];
    const sv = storyViewsAgg[0];

    return {
      profileVisits: {
        total: profileTotalRow[0]?.c ?? 0,
        uniqueVisitors: profileUniqueRow[0]?.c ?? 0,
        todayTotal: profileTodayTotalRow[0]?.c ?? 0,
        todayUnique: profileTodayUniqueRow[0]?.c ?? 0,
      },
      postViews: {
        totalRecords: pv?.totalRecords ?? 0,
        uniqueViewers: pv?.uniqueViewers ?? 0,
      },
      storyViews: {
        totalRecords: sv?.totalRecords ?? 0,
        uniqueViewers: sv?.uniqueViewers ?? 0,
      },
      newFollowers: {
        today: followersTodayRow[0]?.c ?? 0,
        last7Days: followers7dRow[0]?.c ?? 0,
      },
      activityOnMyPosts: {
        reactionsLast7Days: react7dRow[0]?.c ?? 0,
        commentsLast7Days: comments7dRow[0]?.c ?? 0,
        sharesLast7Days: shares7dRow[0]?.c ?? 0,
      },
    };
  } catch (e) {
    console.error("[profile-analytics] getMyProfileAnalytics", e);
    return empty;
  }
}
