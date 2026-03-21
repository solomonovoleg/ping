export type ModuleTelemetryRow = {
  id: string;
  label: string;
  requests: number;
  avgMs: number;
  errors5xx: number;
  errors4xx: number;
  limited429: number;
  uniqueUsersThisHour: number;
};

export type TelemetryRecentError = {
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

export type ModulesTelemetryPayload = {
  generatedAt: string;
  uptimeSec: number;
  modules: ModuleTelemetryRow[];
  recentErrors: TelemetryRecentError[];
};
