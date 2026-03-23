import { getEdgePool } from "../db/pool.js";
import type { CompanionCampaignConfigPayload } from "./types.js";
import { buildResultsLivePayload } from "./build-results-live.js";
import { mapCompanionUiFromConfig } from "./campaign-ui-config.js";
import { fetchLatestPrizeDrawWinners } from "./prize-results-repo.js";
import { ensureEdgeCampaign, findCampaignByPublicId } from "./repo.js";
import { computeInteractLocked } from "./interact-lock.js";
import { listTaskPresetsFromConfig } from "../tasks/preset-tasks-parse.js";

const ALLOWED_STATUS = new Set(["draft", "published", "paused", "ended"]);

function parsePingInviteDm(configJson: unknown): { template: string; codeExpiresInHours: number } {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const raw = root.pingInviteDm;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { template: "", codeExpiresInHours: 168 };
  }
  const o = raw as Record<string, unknown>;
  const template = typeof o.template === "string" ? o.template : "";
  const h = o.codeExpiresInHours;
  let hours = typeof h === "number" && Number.isFinite(h) ? Math.floor(h) : 168;
  hours = Math.min(720, Math.max(1, hours));
  return { template, codeExpiresInHours: hours };
}

function parseScheduleEndsAt(configJson: unknown): string | null {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const sch = root.schedule;
  const s = sch && typeof sch === "object" && !Array.isArray(sch) ? (sch as Record<string, unknown>) : {};
  const endsAt = s.endsAt;
  if (typeof endsAt === "string" && endsAt.trim()) return endsAt.trim();
  return null;
}

function normalizeStatus(raw: string): CompanionCampaignConfigPayload["status"] {
  const s = String(raw || "draft").toLowerCase();
  if (ALLOWED_STATUS.has(s)) return s as CompanionCampaignConfigPayload["status"];
  return "published";
}

function defaultTemplates(giftsJson: unknown): unknown[] {
  if (Array.isArray(giftsJson)) return giftsJson;
  if (giftsJson && typeof giftsJson === "object" && Array.isArray((giftsJson as { templates?: unknown[] }).templates)) {
    return (giftsJson as { templates: unknown[] }).templates;
  }
  return [];
}

export async function getCampaignConfigByEdgeId(
  edgeId: string,
): Promise<CompanionCampaignConfigPayload | null> {
  if (!getEdgePool()) return null;
  await ensureEdgeCampaign(edgeId);
  const row = await findCampaignByPublicId(edgeId);
  if (!row) return null;
  const livePack = await fetchLatestPrizeDrawWinners(edgeId);
  const resultsLive = buildResultsLivePayload(row.gifts_json, livePack);
  const scheduleEndsAt = parseScheduleEndsAt(row.config_json);
  const interactLocked = computeInteractLocked(row);
  const taskPresets = listTaskPresetsFromConfig(row.config_json);
  const pingInviteDm = parsePingInviteDm(row.config_json);
  return {
    status: normalizeStatus(row.status),
    title: row.title.trim() || "Кампания EDGE",
    gifts: { templates: defaultTemplates(row.gifts_json) },
    leaderboard: { globalEnabled: row.leaderboard_global_enabled },
    followReward: { enabled: row.follow_reward_enabled },
    edgeId,
    edgeType: row.edge_type || "character",
    companionUi: mapCompanionUiFromConfig(row.config_json),
    resultsLive,
    scheduleEndsAt,
    interactLocked,
    creatorPlatformUserId: row.creator_platform_user_id?.trim() || null,
    taskPresets,
    pingInviteDm,
  };
}
