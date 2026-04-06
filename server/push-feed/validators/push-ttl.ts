import { PUSH_TTL_VALUES, type PushTtlValue } from "@shared/schema";
import { PUSH_TTL_MS } from "../constants/push-ttl";

export function parsePushTtl(raw: unknown): PushTtlValue {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return (PUSH_TTL_VALUES as readonly string[]).includes(value) ? (value as PushTtlValue) : "24h";
}

export function pushTtlExpiresAt(ttl: PushTtlValue): Date | null {
  if (ttl === "forever") return null;
  return new Date(Date.now() + PUSH_TTL_MS[ttl]);
}
