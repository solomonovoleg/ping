import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { contentReports } from "@shared/schema";
import type { ContentReportStatus } from "@shared/schema/content-reports";
import { reportsFindOpenDuplicate } from "./reports-find-open-duplicate/reports-find-open-duplicate";

const OPEN = "open" as ContentReportStatus;

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { message?: unknown; code?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : "";
  const message = typeof maybe.message === "string" ? maybe.message.toLowerCase() : "";
  // Postgres undefined_column (42703) and fallback by text for wrapped drivers.
  return code === "42703" || message.includes("column") && message.includes("does not exist");
}

export async function reportsCreate(input: {
  reporterUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
  reasonCode?: string | null;
  contextPostId?: string | null;
  contextChatId?: string | null;
}): Promise<{ id: string; duplicate: boolean }> {
  const db = getDb();
  const reason = input.reason.trim().slice(0, 2000);
  const rc = input.reasonCode?.trim().slice(0, 32) || null;
  const ctxPost = input.contextPostId?.trim().slice(0, 128) || null;
  const ctxChat = input.contextChatId?.trim().slice(0, 128) || null;
  const tid = input.targetId.trim().slice(0, 512);
  const existingId = await reportsFindOpenDuplicate(input.reporterUserId, input.targetType, tid, 90);
  if (existingId) {
    return { id: existingId, duplicate: true };
  }
  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(contentReports)
      .values({
        reporterUserId: input.reporterUserId,
        targetType: input.targetType,
        targetId: tid,
        contextPostId: ctxPost,
        contextChatId: ctxChat,
        reasonCode: rc,
        reason,
        status: OPEN,
      })
      .returning({ id: contentReports.id });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    // Backward compatibility: allow creating reports on partially migrated DBs.
    [row] = await db
      .insert(contentReports)
      .values({
        reporterUserId: input.reporterUserId,
        targetType: input.targetType,
        targetId: tid,
        reason,
        status: OPEN,
      })
      .returning({ id: contentReports.id });
  }
  if (!row) throw new Error("insert report failed");
  return { id: row.id, duplicate: false };
}

export async function reportsListForAdmin(opts: {
  status?: ContentReportStatus;
  limit: number;
  offset: number;
}): Promise<{ items: (typeof contentReports.$inferSelect)[]; total: number }> {
  try {
    return await reportsListForAdminFull(opts);
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    return reportsListForAdminLegacy(opts);
  }
}

async function reportsListForAdminFull(opts: {
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

async function reportsListForAdminLegacy(opts: {
  status?: ContentReportStatus;
  limit: number;
  offset: number;
}): Promise<{ items: (typeof contentReports.$inferSelect)[]; total: number }> {
  const db = getDb();
  const statusFilter = opts.status ? sql`WHERE status = ${opts.status}` : sql``;
  const countRes = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM content_reports ${statusFilter}`);
  const rows = await db.execute<{
    id: string;
    reporter_user_id: string;
    target_type: string;
    target_id: string;
    reason: string;
    status: string;
    admin_note: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
  }>(
    sql`SELECT id, reporter_user_id, target_type, target_id, reason, status,
               admin_note, resolved_by, resolved_at, created_at
        FROM content_reports ${statusFilter}
        ORDER BY created_at DESC LIMIT ${opts.limit} OFFSET ${opts.offset}`,
  );
  const items = (Array.isArray(rows) ? rows : []).map((r) => ({
    id: r.id,
    reporterUserId: r.reporter_user_id,
    targetType: r.target_type,
    targetId: r.target_id,
    contextPostId: null,
    contextChatId: null,
    reasonCode: null,
    reason: r.reason,
    status: r.status,
    adminNote: r.admin_note,
    resolvedBy: r.resolved_by,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at) : null,
    createdAt: new Date(r.created_at),
  })) as unknown as (typeof contentReports.$inferSelect)[];
  const total = (countRes as unknown as { rows?: { n?: number }[] }).rows?.[0]?.n ?? 0;
  return { items, total };
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
