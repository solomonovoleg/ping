/**
 * In-memory хранилище счётчиков и недавних ошибок по модулям API.
 */
import type { Request, Response } from "express";
import { getUserId } from "../../auth/session";
import { MODULE_LABELS_RU, resolveApiModule } from "./api-module-registry";
import { telemetryHintsForHttpError } from "./error-hints";
import type { ModulesTelemetryPayload, ModuleTelemetryRow, TelemetryRecentError } from "./types";

import "./express-request";

const MAX_UNIQUE_PER_MODULE = 25_000;
const RECENT_ERRORS_CAP = 120;
const PATH_PREVIEW_LEN = 96;

type ModuleAgg = {
  requests: number;
  errors5xx: number;
  errors4xx: number;
  limited429: number;
  sumDurationMs: number;
  hourBucket: number;
  uniqueUserIds: Set<string>;
};

const byModule = new Map<string, ModuleAgg>();
const recentErrors: TelemetryRecentError[] = [];

function currentHourBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

function getAgg(moduleId: string): ModuleAgg {
  let a = byModule.get(moduleId);
  if (!a) {
    a = {
      requests: 0,
      errors5xx: 0,
      errors4xx: 0,
      limited429: 0,
      sumDurationMs: 0,
      hourBucket: currentHourBucket(),
      uniqueUserIds: new Set(),
    };
    byModule.set(moduleId, a);
  }
  const hb = currentHourBucket();
  if (a.hourBucket !== hb) {
    a.hourBucket = hb;
    a.uniqueUserIds.clear();
  }
  return a;
}

function pushRecent(e: TelemetryRecentError): void {
  recentErrors.unshift(e);
  while (recentErrors.length > RECENT_ERRORS_CAP) recentErrors.pop();
}

export function recordApiTrafficFinish(req: Request, res: Response, startMs: number): void {
  const path = (req.originalUrl || req.url || "").split("?")[0] || "";
  if (!path.startsWith("/api")) return;

  const moduleId = resolveApiModule(path);
  const durationMs = Math.max(0, Date.now() - startMs);
  const status = res.statusCode;
  const uid = getUserId(req) ?? null;
  const detail = req.telemetryErrorDetail?.slice(0, 400) ?? null;

  const a = getAgg(moduleId);
  a.requests += 1;
  a.sumDurationMs += durationMs;
  if (uid && a.uniqueUserIds.size < MAX_UNIQUE_PER_MODULE) {
    a.uniqueUserIds.add(uid);
  }
  if (status === 429) a.limited429 += 1;
  if (status >= 500) a.errors5xx += 1;
  else if (status >= 400 && status < 500) a.errors4xx += 1;

  if (status >= 500 || status === 429) {
    const label = MODULE_LABELS_RU[moduleId] ?? moduleId;
    pushRecent({
      at: new Date().toISOString(),
      module: moduleId,
      moduleLabel: label,
      method: req.method,
      path: path.length > PATH_PREVIEW_LEN ? `${path.slice(0, PATH_PREVIEW_LEN)}…` : path,
      status,
      durationMs,
      userId: uid,
      detail,
      hints: telemetryHintsForHttpError(status, durationMs, detail),
    });
  }

  req.telemetryErrorDetail = undefined;
}

export function getModulesTelemetryPayload(): ModulesTelemetryPayload {
  const rows: ModuleTelemetryRow[] = [];
  for (const [id, a] of byModule.entries()) {
    if (a.requests === 0 && a.errors5xx === 0 && a.errors4xx === 0) continue;
    rows.push({
      id,
      label: MODULE_LABELS_RU[id] ?? id,
      requests: a.requests,
      avgMs: a.requests > 0 ? Math.round(a.sumDurationMs / a.requests) : 0,
      errors5xx: a.errors5xx,
      errors4xx: a.errors4xx,
      limited429: a.limited429,
      uniqueUsersThisHour: a.uniqueUserIds.size,
    });
  }
  rows.sort((x, y) => y.requests - x.requests);
  return {
    generatedAt: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    modules: rows,
    recentErrors: [...recentErrors],
  };
}
