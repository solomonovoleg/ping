import type { EdgeCampaignRow } from "../../companion/repo.js";
import { computeInteractLocked } from "../../companion/interact-lock.js";
import { readDisplayAudience } from "../config/read-display-audience.js";
import { parseMoneyConfigFromRoot } from "../config/parse-money-config.js";
import { readScheduleEndsAtIso } from "../config/read-schedule-ends-at.js";
import { effectiveLeaderboardXpFrozen } from "../../participant/leaderboard-draw-freeze.js";

const ALLOWED_STATUS = new Set(["draft", "published", "paused", "ended"]);

function normalizeStatus(raw: string): "draft" | "published" | "paused" | "ended" {
  const s = String(raw || "draft").toLowerCase();
  if (ALLOWED_STATUS.has(s)) return s as "draft" | "published" | "paused" | "ended";
  return "published";
}

export type MoneyCampaignPublicPayload = {
  edgeId: string;
  edgeType: "money";
  status: ReturnType<typeof normalizeStatus>;
  title: string;
  scheduleEndsAt: string | null;
  displayAudience: "self" | "followers" | "public";
  creatorPlatformUserId: string | null;
  /** Начисления/игра недоступны (черновик, пауза, срок, завершение). */
  interactLocked: boolean;
  money: ReturnType<typeof parseMoneyConfigFromRoot>;
  leaderboardPrimaryEnabled: boolean;
  leaderboardSecondaryEnabled: boolean;
  leaderboardPrimaryFrozenEffective: boolean;
  leaderboardSecondaryFrozenEffective: boolean;
};

export function buildMoneyCampaignPublicPayload(row: EdgeCampaignRow): MoneyCampaignPublicPayload | null {
  if ((row.edge_type || "").trim() !== "money") return null;
  const now = new Date();
  return {
    edgeId: row.public_id,
    edgeType: "money",
    status: normalizeStatus(row.status),
    title: row.title.trim() || "EDGE MONEY",
    scheduleEndsAt: readScheduleEndsAtIso(row.config_json),
    displayAudience: readDisplayAudience(row.config_json),
    creatorPlatformUserId: row.creator_platform_user_id?.trim() || null,
    interactLocked: computeInteractLocked(row),
    money: parseMoneyConfigFromRoot(row.config_json),
    leaderboardPrimaryEnabled: row.leaderboard_primary_enabled,
    leaderboardSecondaryEnabled: row.leaderboard_secondary_enabled,
    leaderboardPrimaryFrozenEffective: effectiveLeaderboardXpFrozen(row, "primary", now),
    leaderboardSecondaryFrozenEffective: effectiveLeaderboardXpFrozen(row, "secondary", now),
  };
}
