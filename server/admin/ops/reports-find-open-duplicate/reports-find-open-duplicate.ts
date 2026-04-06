import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { contentReports } from "@shared/schema";
import type { ContentReportStatus } from "@shared/schema/content-reports";

const OPEN = "open" as ContentReportStatus;

/** If an open duplicate exists within the window, return its id (skip insert). */
export async function reportsFindOpenDuplicate(
  reporterUserId: string,
  targetType: string,
  targetId: string,
  windowMinutes: number,
): Promise<string | null> {
  const db = getDb();
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ id: contentReports.id })
    .from(contentReports)
    .where(
      and(
        eq(contentReports.reporterUserId, reporterUserId),
        eq(contentReports.targetType, targetType),
        eq(contentReports.targetId, targetId.trim().slice(0, 512)),
        eq(contentReports.status, OPEN),
        gte(contentReports.createdAt, since),
      ),
    )
    .orderBy(desc(contentReports.createdAt))
    .limit(1);
  return row?.id ?? null;
}
