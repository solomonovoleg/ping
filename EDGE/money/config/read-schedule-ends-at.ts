import { asRecord } from "./as-record.js";

export function readScheduleEndsAtIso(configJson: unknown): string | null {
  const root = asRecord(configJson);
  const sch = asRecord(root.schedule);
  const endsAt = sch.endsAt;
  if (typeof endsAt === "string" && endsAt.trim()) return endsAt.trim();
  return null;
}
