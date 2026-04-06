import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { users, contentReports } from "@shared/schema";
import { adminMediaStudioCampaignPosts } from "@shared/schema/admin-media-studio";
import { getDb } from "../db";

function parseSince(raw: unknown): Date | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseNavBadgeSinceQuery(query: Record<string, unknown>): {
  usersSince: Date;
  mediaSince: Date;
  reportsSince: Date;
} {
  const fallback = () => new Date();
  return {
    usersSince: parseSince(query.usersSince) ?? fallback(),
    mediaSince: parseSince(query.mediaSince) ?? fallback(),
    reportsSince: parseSince(query.reportsSince) ?? fallback(),
  };
}

export async function countNewUsersSince(since: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(isNull(users.deletedAt), gt(users.createdAt, since)));
  return row?.n ?? 0;
}

export async function countMediaStudioPublishedSince(since: Date): Promise<number> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(adminMediaStudioCampaignPosts)
      .where(and(eq(adminMediaStudioCampaignPosts.state, "published"), gt(adminMediaStudioCampaignPosts.updatedAt, since)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

export async function countOpenReportsSince(since: Date): Promise<number> {
  try {
    const db = getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(contentReports)
      .where(and(eq(contentReports.status, "open"), gt(contentReports.createdAt, since)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}
