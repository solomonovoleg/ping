import type { EdgeCampaignRow } from "./repo.js";

/** Блок кормления/игры: черновик, пауза, завершение или `schedule.endsAt` в прошлом. */
export function computeInteractLocked(row: Pick<EdgeCampaignRow, "status" | "config_json">): boolean {
  const st = String(row.status || "").toLowerCase();
  if (st === "ended" || st === "paused" || st === "draft") return true;
  const root =
    row.config_json && typeof row.config_json === "object" && !Array.isArray(row.config_json)
      ? (row.config_json as Record<string, unknown>)
      : {};
  const sch = root.schedule;
  const s = sch && typeof sch === "object" && !Array.isArray(sch) ? (sch as Record<string, unknown>) : {};
  const endsAt = s.endsAt;
  if (typeof endsAt === "string" && endsAt.trim()) {
    const t = new Date(endsAt).getTime();
    if (Number.isFinite(t) && Date.now() > t) return true;
  }
  return false;
}
