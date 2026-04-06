import type { PushTtlValue } from "@shared/schema";

const HOUR_MS = 60 * 60 * 1000;

export const PUSH_TTL_MS: Record<Exclude<PushTtlValue, "forever">, number> = {
  "12h": 12 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  "48h": 48 * HOUR_MS,
  "56h": 56 * HOUR_MS,
};
