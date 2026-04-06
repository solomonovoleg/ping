import { and, desc, eq, sql } from "drizzle-orm";
import { BUSINESS_STATUS_VALUES, businessStatusRequests, users } from "@shared/schema";
import { getDb } from "../db";

type BusinessStatusValue = (typeof BUSINESS_STATUS_VALUES)[number];
type BusinessRequestDecision = "approved" | "rejected" | "revision_required";

const REASON_MAX_LENGTH = 2000;
const ADMIN_COMMENT_MAX_LENGTH = 1000;
const MAX_LINKS = 3;
const MAX_LINK_LENGTH = 300;

export class BusinessStatusServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeReason(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new BusinessStatusServiceError(400, "Укажите причину заявки");
  }
  const value = raw.trim();
  if (!value) {
    throw new BusinessStatusServiceError(400, "Причина заявки не может быть пустой");
  }
  return value.slice(0, REASON_MAX_LENGTH);
}

function normalizeComment(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value.slice(0, ADMIN_COMMENT_MAX_LENGTH) : null;
}

function normalizeLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return value.slice(0, MAX_LINK_LENGTH);
  } catch {
    return null;
  }
}

function normalizeLinks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const item of raw) {
    const normalized = normalizeLink(item);
    if (!normalized) continue;
    unique.add(normalized);
    if (unique.size >= MAX_LINKS) break;
  }
  return [...unique];
}

function parseLinksJson(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeLinks(parsed);
  } catch {
    return [];
  }
}

export function canSubmitBusinessRequestByStatus(status: string | null | undefined): boolean {
  return status === "none" || status === "rejected" || status === "revision_required";
}

export function mapDecisionToBusinessStatus(decision: BusinessRequestDecision): BusinessStatusValue {
  if (decision === "approved") return "approved";
  if (decision === "rejected") return "rejected";
  return "revision_required";
}

export function assessModerationTransition(
  currentRequestStatus: string,
  decision: BusinessRequestDecision,
): "apply" | "idempotent" | "conflict" {
  if (currentRequestStatus === "submitted") return "apply";
  if (currentRequestStatus === decision) return "idempotent";
  return "conflict";
}

function normalizeDecision(raw: unknown): BusinessRequestDecision {
  if (raw === "approved" || raw === "rejected" || raw === "revision_required") return raw;
  throw new BusinessStatusServiceError(400, "Допустимые решения: approved, rejected, revision_required");
}

function normalizeListStatus(raw: unknown): "submitted" | "approved" | "rejected" | "revision_required" | undefined {
  if (
    raw === "submitted" ||
    raw === "approved" ||
    raw === "rejected" ||
    raw === "revision_required"
  ) {
    return raw;
  }
  return undefined;
}

type RequestRow = typeof businessStatusRequests.$inferSelect;

function serializeRequest(row: RequestRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    reason: row.reason,
    links: parseLinksJson(row.linksJson),
    consentModeration: row.consentModeration === true,
    status: row.status,
    adminComment: row.adminComment ?? null,
    moderatedBy: row.moderatedBy ?? null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    moderatedAt: row.moderatedAt ? row.moderatedAt.toISOString() : null,
  };
}

export async function submitBusinessStatusRequest(userId: string, body: {
  reason?: unknown;
  links?: unknown;
  consentModeration?: unknown;
}) {
  const reason = normalizeReason(body.reason);
  const links = normalizeLinks(body.links);
  if (body.consentModeration !== true) {
    throw new BusinessStatusServiceError(400, "Нужно подтвердить согласие на модерацию");
  }
  const db = getDb();
  const now = new Date();
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id, businessStatus: users.businessStatus })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!user) throw new BusinessStatusServiceError(404, "Пользователь не найден");

      const [active] = await tx
        .select({ id: businessStatusRequests.id })
        .from(businessStatusRequests)
        .where(and(eq(businessStatusRequests.userId, userId), eq(businessStatusRequests.status, "submitted")))
        .limit(1);
      if (active) {
        throw new BusinessStatusServiceError(409, "У вас уже есть активная заявка на модерации");
      }
      if (!canSubmitBusinessRequestByStatus(user.businessStatus)) {
        throw new BusinessStatusServiceError(409, "Новая заявка сейчас недоступна");
      }

      const [created] = await tx
        .insert(businessStatusRequests)
        .values({
          userId,
          reason,
          linksJson: JSON.stringify(links),
          consentModeration: true,
          status: "submitted",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      await tx
        .update(users)
        .set({
          businessStatus: "pending",
          businessStatusUpdatedAt: now,
          businessStatusUpdatedBy: null,
        })
        .where(eq(users.id, userId));

      return {
        businessStatus: "pending" as const,
        request: serializeRequest(created),
      };
    });
  } catch (error) {
    const maybe = error as { code?: string };
    if (maybe?.code === "23505") {
      throw new BusinessStatusServiceError(409, "У вас уже есть активная заявка на модерации");
    }
    throw error;
  }
}

export async function getMyBusinessStatusRequest(userId: string) {
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, businessStatus: users.businessStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new BusinessStatusServiceError(404, "Пользователь не найден");

  const [active, latest] = await Promise.all([
    db
      .select()
      .from(businessStatusRequests)
      .where(and(eq(businessStatusRequests.userId, userId), eq(businessStatusRequests.status, "submitted")))
      .orderBy(desc(businessStatusRequests.createdAt))
      .limit(1),
    db
      .select()
      .from(businessStatusRequests)
      .where(eq(businessStatusRequests.userId, userId))
      .orderBy(desc(businessStatusRequests.createdAt))
      .limit(1),
  ]);

  return {
    businessStatus: user.businessStatus as BusinessStatusValue,
    activeRequest: serializeRequest(active[0] ?? null),
    latestRequest: serializeRequest(latest[0] ?? null),
  };
}

export async function listBusinessStatusRequestsForAdmin(opts: {
  status?: unknown;
  limit?: unknown;
  offset?: unknown;
}) {
  const status = normalizeListStatus(opts.status);
  const limitRaw = typeof opts.limit === "number" ? opts.limit : Number(opts.limit);
  const offsetRaw = typeof opts.offset === "number" ? opts.offset : Number(opts.offset);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100) : 20;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;
  const db = getDb();

  const whereClause = status ? eq(businessStatusRequests.status, status) : sql`TRUE`;
  const rows = await db
    .select({
      request: businessStatusRequests,
      user: {
        id: users.id,
        publicId: users.publicId,
        displayName: users.displayName,
        surname: users.surname,
        avatarUrl: users.avatarUrl,
        businessStatus: users.businessStatus,
      },
    })
    .from(businessStatusRequests)
    .innerJoin(users, eq(users.id, businessStatusRequests.userId))
    .where(whereClause)
    .orderBy(desc(businessStatusRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const [countRow] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(businessStatusRequests)
    .where(whereClause);

  return {
    items: rows.map((row) => ({
      ...serializeRequest(row.request),
      user: {
        id: row.user.id,
        publicId: row.user.publicId,
        displayName: row.user.displayName ?? null,
        surname: row.user.surname ?? null,
        avatarUrl: row.user.avatarUrl ?? null,
        businessStatus: row.user.businessStatus as BusinessStatusValue,
      },
    })),
    total: Number(countRow?.c ?? 0),
    limit,
    offset,
  };
}

export async function moderateBusinessStatusRequest(input: {
  adminUserId: string;
  requestId: string;
  decision: unknown;
  adminComment?: unknown;
}) {
  const decision = normalizeDecision(input.decision);
  const adminComment = normalizeComment(input.adminComment);
  const nextBusinessStatus = mapDecisionToBusinessStatus(decision);
  const now = new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(businessStatusRequests)
      .where(eq(businessStatusRequests.id, input.requestId))
      .limit(1);
    if (!request) {
      throw new BusinessStatusServiceError(404, "Заявка не найдена");
    }
    const transition = assessModerationTransition(request.status, decision);
    if (transition === "conflict") {
      throw new BusinessStatusServiceError(409, "Заявка уже обработана другим решением");
    }

    if (transition === "idempotent") {
      const [currentUser] = await tx
        .select({ businessStatus: users.businessStatus })
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);
      if (!currentUser || currentUser.businessStatus !== nextBusinessStatus) {
        await tx
          .update(users)
          .set({
            businessStatus: nextBusinessStatus,
            businessStatusUpdatedAt: now,
            businessStatusUpdatedBy: input.adminUserId,
          })
          .where(eq(users.id, request.userId));
      }
      return {
        idempotent: true,
        decision,
        request: serializeRequest(request),
      };
    }

    const [updatedRequest] = await tx
      .update(businessStatusRequests)
      .set({
        status: decision,
        adminComment,
        moderatedBy: input.adminUserId,
        moderatedAt: now,
        updatedAt: now,
      })
      .where(eq(businessStatusRequests.id, request.id))
      .returning();

    await tx
      .update(users)
      .set({
        businessStatus: nextBusinessStatus,
        businessStatusUpdatedAt: now,
        businessStatusUpdatedBy: input.adminUserId,
      })
      .where(eq(users.id, request.userId));

    return {
      idempotent: false,
      decision,
      request: serializeRequest(updatedRequest),
    };
  });
}
