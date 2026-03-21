import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { contentReports } from "@shared/schema";
import type { ContentReportStatus } from "@shared/schema/content-reports";

const OPEN = "open" as ContentReportStatus;

export async function reportsCreate(input: {
  reporterUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const reason = input.reason.trim().slice(0, 2000);
  const [row] = await db
    .insert(contentReports)
    .values({
      reporterUserId: input.reporterUserId,
      targetType: input.targetType,
      targetId: input.targetId.trim().slice(0, 512),
      reason,
      status: OPEN,
    })
    .returning({ id: contentReports.id });
  if (!row) throw new Error("insert report failed");
  return row;
}

export async function reportsListForAdmin(opts: {
  status?: ContentReportStatus;
  limit: number;
  offset: number;
}): Promise<{ items: (typeof contentReports.$inferSelect)[]; total: number }> {
  const db = getDb();
  if (opts.status) {
    const st = opts.status;
    const [countRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(contentReports)
      .where(eq(contentReports.status, st));
    const items = await db
      .select()
      .from(contentReports)
      .where(eq(contentReports.status, st))
      .orderBy(desc(contentReports.createdAt))
      .limit(opts.limit)
      .offset(opts.offset);
    return { items, total: countRow?.n ?? 0 };
  }
  const [countRow] = await db.select({ n: sql<number>`count(*)::int` }).from(contentReports);
  const items = await db
    .select()
    .from(contentReports)
    .orderBy(desc(contentReports.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);
  return { items, total: countRow?.n ?? 0 };
}

export async function reportsSetStatus(
  id: string,
  status: ContentReportStatus,
  adminId: string,
  adminNote?: string
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .update(contentReports)
    .set({
      status,
      adminNote: adminNote?.trim().slice(0, 2000) ?? null,
      resolvedBy: adminId,
      resolvedAt: new Date(),
    })
    .where(and(eq(contentReports.id, id), eq(contentReports.status, OPEN)))
    .returning({ id: contentReports.id });
  return !!row;
}
