import { API, apiFetch } from "@/lib/api-base";

function adminOpsFetch(path: string, init?: RequestInit) {
  return apiFetch(`${API}${path}`, { ...init, credentials: "include" });
}

export type PlatformOpsDto = {
  bannerEnabled: boolean;
  bannerText: string;
  bannerVariant: "info" | "warning" | "danger";
  maintenanceMode: boolean;
  /** Ужесточить лимиты для неавторизованных запросов к API */
  strictApiShield: boolean;
};

export async function fetchOpsPlatform(): Promise<PlatformOpsDto> {
  const res = await adminOpsFetch("/admin/ops/platform");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchOpsPlatform(patch: Partial<PlatformOpsDto>): Promise<PlatformOpsDto & { message?: string }> {
  const res = await adminOpsFetch("/admin/ops/platform", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message || "Ошибка сохранения");
  }
  return res.json();
}

export type OpsReportRow = {
  id: string;
  reporterUserId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export async function fetchOpsReports(opts: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ reports: OpsReportRow[]; total: number }> {
  const p = new URLSearchParams();
  if (opts.status) p.set("status", opts.status);
  if (opts.limit != null) p.set("limit", String(opts.limit));
  if (opts.offset != null) p.set("offset", String(opts.offset));
  const res = await adminOpsFetch(`/admin/ops/reports?${p}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function patchOpsReport(
  id: string,
  body: { status: "resolved" | "dismissed"; adminNote?: string }
): Promise<void> {
  const res = await adminOpsFetch(`/admin/ops/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error((d as { message?: string }).message || "Ошибка");
  }
}

export type AnnouncementDto = {
  banner: { enabled: boolean; text: string; variant: "info" | "warning" | "danger" };
  maintenanceMode: boolean;
};

export async function fetchPublicAnnouncement(): Promise<AnnouncementDto> {
  const res = await fetch(`${API}/platform/announcement`, { credentials: "include" });
  if (!res.ok) {
    return { banner: { enabled: false, text: "", variant: "info" }, maintenanceMode: false };
  }
  return res.json();
}

export type TrafficShieldMinuteDto = {
  minute: number;
  total: number;
  anonymous: number;
  authenticated: number;
  limited429: number;
};

export type TrafficShieldLimitsBlock = {
  anonymousNormal: number;
  anonymousStrict: number;
  authenticatedNormal: number;
  authenticatedStrict: number;
};

export type TrafficShieldDto = {
  generatedAt: string;
  strictApiShield: boolean;
  windowMs: number;
  limits: {
    read: TrafficShieldLimitsBlock;
    mutation: TrafficShieldLimitsBlock;
  };
  currentMinute: TrafficShieldMinuteDto | null;
  history: TrafficShieldMinuteDto[];
  uptimeSec: number;
  note: string;
};

export async function fetchOpsTrafficShield(): Promise<TrafficShieldDto> {
  const res = await adminOpsFetch("/admin/ops/traffic-shield");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type ModulesTelemetryRow = {
  id: string;
  label: string;
  requests: number;
  avgMs: number;
  errors5xx: number;
  errors4xx: number;
  limited429: number;
  uniqueUsersThisHour: number;
};

export type ModulesTelemetryRecentError = {
  at: string;
  module: string;
  moduleLabel: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: string | null;
  detail: string | null;
  hints: string[];
};

export type ModulesTelemetryDto = {
  generatedAt: string;
  uptimeSec: number;
  modules: ModulesTelemetryRow[];
  recentErrors: ModulesTelemetryRecentError[];
};

export async function fetchModulesTelemetry(): Promise<ModulesTelemetryDto> {
  const res = await adminOpsFetch("/admin/modules-telemetry");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export type DiskMountStatsDto = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
};

export type DiskBreakdownRowDto = {
  id: string;
  label: string;
  section: "uploads" | "database" | "disk";
  bytes: number;
  files: number | null;
  pctOfDiskTotal: number | null;
  pctOfDiskFree: number | null;
};

export type ServerHostSnapshotDto = {
  projectPath: string;
  projectDiskBytes: number | null;
  projectDiskSource: "du" | "walk_skipped" | "none";
  projectDiskError: string | null;
  projectPctOfMountTotal: number | null;
  projectPctOfMountUsed: number | null;
  projectPctOfMountFree: number | null;
  uploadsDirBytes: number | null;
  uploadsPctOfProjectDisk: number | null;
  memTotalBytes: number;
  memFreeBytes: number;
  memUsedBytes: number;
  memUsedPct: number;
  processRssBytes: number;
  processRssPctOfMemTotal: number | null;
  processRssPctOfMemUsed: number | null;
  processRssPctOfProjectDisk: number | null;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  cpuCount: number;
  loadPerCore1: number | null;
};

export type DiskOpsReportDto = {
  generatedAt: string;
  cwd: string;
  uploadsDir: string;
  statfsPath: string;
  projectPath: string;
  s3Configured: boolean;
  mount: DiskMountStatsDto | null;
  mountError: string | null;
  host: ServerHostSnapshotDto;
  rows: DiskBreakdownRowDto[];
};

export async function fetchOpsDisk(): Promise<DiskOpsReportDto> {
  const res = await adminOpsFetch("/admin/ops/disk");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
