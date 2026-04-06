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
  clientTelemetry?: {
    tablePasteFallback: {
      counts: {
        fallback_shown: number;
        retry_clicked: number;
        reopen_success: number;
      };
      uniqueUsers: number;
      recent: Array<{
        at: string;
        event: "fallback_shown" | "retry_clicked" | "reopen_success";
        chatId: string;
        cols: number;
        rows: number;
        viaRetry: boolean;
        userId: string;
      }>;
    };
    /** С момента рестарта процесса; может отсутствовать на старых билдах API. */
    iseeTimeToFirstPlay?: {
      count: number;
      uniqueUsers: number;
      recent: Array<{
        at: string;
        userId: string;
        ms: number;
        postId: string;
        connectionType: string | null;
      }>;
    };
  };
};
