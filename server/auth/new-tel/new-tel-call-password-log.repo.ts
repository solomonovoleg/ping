import { desc, gte, sql } from "drizzle-orm";
import { newTelCallPasswordLog } from "@shared/schema";
import { getDb } from "../../db/client";

export type NewTelCallPasswordLogScenario = "signup" | "password_reset";

export type InsertNewTelCallPasswordLogInput = {
  scenario: NewTelCallPasswordLogScenario;
  apiMethod: string;
  durationMs: number;
  httpStatus: number | null;
  apiOk: boolean | null;
  errorMessage: string | null;
  requestRedacted: Record<string, unknown> | null;
  responseSanitized: unknown;
  detail?: Record<string, unknown> | null;
};

const START_METHOD = "call-password/start-password-call";
const STATUS_METHOD = "call-password/get-password-call-status";

function pgErrCode(e: unknown): string | undefined {
  return e && typeof e === "object" && "code" in e && typeof (e as { code: unknown }).code === "string"
    ? (e as { code: string }).code
    : undefined;
}

/** Календарный день в UTC — одно выражение и в SELECT, и в GROUP BY (иначе PostgreSQL даёт 42803). */
function utcCalendarDay(): ReturnType<typeof sql> {
  return sql`(${newTelCallPasswordLog.createdAt} at time zone 'UTC')::date`;
}

export async function insertNewTelCallPasswordLogRow(input: InsertNewTelCallPasswordLogInput): Promise<void> {
  try {
    await getDb().insert(newTelCallPasswordLog).values({
      scenario: input.scenario,
      apiMethod: input.apiMethod,
      durationMs: input.durationMs,
      httpStatus: input.httpStatus,
      apiOk: input.apiOk,
      errorMessage: input.errorMessage,
      requestRedacted: input.requestRedacted,
      responseSanitized: input.responseSanitized as Record<string, unknown> | null,
      detail: input.detail ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[new-tel-log] insert failed:", msg);
  }
}

export type NewTelCallPasswordLogSummary = {
  totalRequests: number;
  startPasswordCalls: number;
  statusPolls: number;
  apiErrors: number;
};

export async function aggregateNewTelCallPasswordLog(from: Date): Promise<NewTelCallPasswordLogSummary> {
  const db = getDb();
  const [row] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      startPasswordCalls: sql<number>`count(*) filter (where ${newTelCallPasswordLog.apiMethod} = ${START_METHOD})::int`,
      statusPolls: sql<number>`count(*) filter (where ${newTelCallPasswordLog.apiMethod} = ${STATUS_METHOD})::int`,
      apiErrors: sql<number>`count(*) filter (where coalesce(${newTelCallPasswordLog.apiOk}, false) = false)::int`,
    })
    .from(newTelCallPasswordLog)
    .where(gte(newTelCallPasswordLog.createdAt, from));
  return {
    totalRequests: row?.totalRequests ?? 0,
    startPasswordCalls: row?.startPasswordCalls ?? 0,
    statusPolls: row?.statusPolls ?? 0,
    apiErrors: row?.apiErrors ?? 0,
  };
}

export type NewTelCallPasswordLogDayBucket = {
  day: string;
  totalRequests: number;
  startPasswordCalls: number;
  statusPolls: number;
  apiErrors: number;
};

export async function aggregateNewTelCallPasswordLogByDay(from: Date): Promise<NewTelCallPasswordLogDayBucket[]> {
  const db = getDb();
  const dayKey = utcCalendarDay();
  const rows = await db
    .select({
      day: sql<string>`${dayKey}::text`,
      totalRequests: sql<number>`count(*)::int`,
      startPasswordCalls: sql<number>`count(*) filter (where ${newTelCallPasswordLog.apiMethod} = ${START_METHOD})::int`,
      statusPolls: sql<number>`count(*) filter (where ${newTelCallPasswordLog.apiMethod} = ${STATUS_METHOD})::int`,
      apiErrors: sql<number>`count(*) filter (where coalesce(${newTelCallPasswordLog.apiOk}, false) = false)::int`,
    })
    .from(newTelCallPasswordLog)
    .where(gte(newTelCallPasswordLog.createdAt, from))
    .groupBy(dayKey)
    .orderBy(desc(dayKey));
  return rows.map((r) => ({
    day: r.day,
    totalRequests: r.totalRequests,
    startPasswordCalls: r.startPasswordCalls,
    statusPolls: r.statusPolls,
    apiErrors: r.apiErrors,
  }));
}

export type NewTelCallPasswordLogListRow = {
  id: string;
  createdAt: string;
  scenario: string;
  apiMethod: string;
  durationMs: number;
  httpStatus: number | null;
  apiOk: boolean | null;
  errorMessage: string | null;
  requestRedacted: unknown;
  responseSanitized: unknown;
  detail: unknown;
};

function mapLogRows(
  rows: {
    id: string;
    createdAt: Date | string;
    scenario: string;
    apiMethod: string;
    durationMs: number;
    httpStatus: number | null;
    apiOk: boolean | null;
    errorMessage: string | null;
    requestRedacted: unknown;
    responseSanitized: unknown;
    detail?: unknown;
  }[],
): NewTelCallPasswordLogListRow[] {
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    scenario: r.scenario,
    apiMethod: r.apiMethod,
    durationMs: r.durationMs,
    httpStatus: r.httpStatus,
    apiOk: r.apiOk,
    errorMessage: r.errorMessage,
    requestRedacted: r.requestRedacted,
    responseSanitized: r.responseSanitized,
    detail: r.detail ?? null,
  }));
}

export async function listNewTelCallPasswordLogRows(from: Date, limit: number): Promise<NewTelCallPasswordLogListRow[]> {
  const safeLimit = Math.min(3000, Math.max(1, Math.floor(limit)));
  const db = getDb();
  const baseWhere = gte(newTelCallPasswordLog.createdAt, from);
  const order = desc(newTelCallPasswordLog.createdAt);

  try {
    const rows = await db
      .select({
        id: newTelCallPasswordLog.id,
        createdAt: newTelCallPasswordLog.createdAt,
        scenario: newTelCallPasswordLog.scenario,
        apiMethod: newTelCallPasswordLog.apiMethod,
        durationMs: newTelCallPasswordLog.durationMs,
        httpStatus: newTelCallPasswordLog.httpStatus,
        apiOk: newTelCallPasswordLog.apiOk,
        errorMessage: newTelCallPasswordLog.errorMessage,
        requestRedacted: newTelCallPasswordLog.requestRedacted,
        responseSanitized: newTelCallPasswordLog.responseSanitized,
        detail: newTelCallPasswordLog.detail,
      })
      .from(newTelCallPasswordLog)
      .where(baseWhere)
      .orderBy(order)
      .limit(safeLimit);
    return mapLogRows(rows);
  } catch (e) {
    const code = pgErrCode(e);
    const msg = e instanceof Error ? e.message : String(e);
    if (code === "42703" && /\bdetail\b/i.test(msg)) {
      const rows = await db
        .select({
          id: newTelCallPasswordLog.id,
          createdAt: newTelCallPasswordLog.createdAt,
          scenario: newTelCallPasswordLog.scenario,
          apiMethod: newTelCallPasswordLog.apiMethod,
          durationMs: newTelCallPasswordLog.durationMs,
          httpStatus: newTelCallPasswordLog.httpStatus,
          apiOk: newTelCallPasswordLog.apiOk,
          errorMessage: newTelCallPasswordLog.errorMessage,
          requestRedacted: newTelCallPasswordLog.requestRedacted,
          responseSanitized: newTelCallPasswordLog.responseSanitized,
        })
        .from(newTelCallPasswordLog)
        .where(baseWhere)
        .orderBy(order)
        .limit(safeLimit);
      return mapLogRows(rows.map((r) => ({ ...r, detail: null })));
    }
    throw e;
  }
}

/** Проверка «есть ли строки» сверх лимита выборки (грубо: count > limit). */
export async function countNewTelCallPasswordLogSince(from: Date): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(newTelCallPasswordLog)
    .where(gte(newTelCallPasswordLog.createdAt, from));
  return row?.c ?? 0;
}
