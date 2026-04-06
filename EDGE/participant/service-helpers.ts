import {
  applyLifeMoodPeakBonus,
  fulfillLifeQueueItem,
  parseLifeSimulationConfig,
  type FulfillAction,
} from "./life-simulation.js";
import type { InteractKind } from "./character-rules.js";
import type { ParticipantStatePayload } from "./types.js";
import type { CharacterRow, ParticipantRow } from "./repo.js";
import { mapParticipantPayload } from "./payload.js";
import { enrichParticipantPayloadWithTasks } from "./payload-task-enrichment.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { computeInteractLocked } from "../companion/interact-lock.js";

export type { FulfillAction } from "./life-simulation.js";

export async function getCampaignPlayLocked(edgeId: string): Promise<boolean | null> {
  const row = await findCampaignByPublicId(edgeId);
  if (!row) return null;
  return computeInteractLocked(row);
}

export function mapPayload(
  edgeId: string,
  platformUserId: string,
  p: ParticipantRow,
  c: CharacterRow,
  now: Date,
  configJson: unknown,
): ParticipantStatePayload {
  return mapParticipantPayload(edgeId, platformUserId, p, c, now, configJson);
}

/** Полный стейт участника с `taskGrants` / `taskProgress` для UI заданий. */
export async function mapPayloadEnriched(
  edgeId: string,
  platformUserId: string,
  p: ParticipantRow,
  c: CharacterRow,
  now: Date,
  configJson: unknown,
): Promise<ParticipantStatePayload> {
  const base = mapParticipantPayload(edgeId, platformUserId, p, c, now, configJson);
  return enrichParticipantPayloadWithTasks(base, configJson);
}

export function parsePrimaryTapBonusRule(configJson: unknown): { tapsPerPoint: number; points: number } | null {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const lbs =
    root.leaderboards && typeof root.leaderboards === "object" && !Array.isArray(root.leaderboards)
      ? (root.leaderboards as Record<string, unknown>)
      : {};
  const primary =
    lbs.primary && typeof lbs.primary === "object" && !Array.isArray(lbs.primary)
      ? (lbs.primary as Record<string, unknown>)
      : {};
  const tapRule =
    primary.tapRule && typeof primary.tapRule === "object" && !Array.isArray(primary.tapRule)
      ? (primary.tapRule as Record<string, unknown>)
      : {};
  const enabled = tapRule.enabled !== false;
  if (!enabled) return null;
  const tapsRaw = Number(tapRule.tapsPerPoint ?? 0);
  const pointsRaw = Number(tapRule.points ?? 0);
  const tapsPerPoint = Number.isFinite(tapsRaw) ? Math.max(1, Math.min(1000, Math.floor(tapsRaw))) : 0;
  const points = Number.isFinite(pointsRaw) ? Math.max(1, Math.min(1000, Math.floor(pointsRaw))) : 0;
  if (!tapsPerPoint || !points) return null;
  return { tapsPerPoint, points };
}

export function applyLifeAfterAction(
  extra: Record<string, unknown>,
  configJson: unknown,
  now: Date,
  prevMood: string,
  newMood: string,
  fulfill: FulfillAction | null,
): Record<string, unknown> {
  const cfg = parseLifeSimulationConfig(configJson);
  if (!cfg.enabled) return extra;
  let e = extra;
  if (fulfill) {
    e = fulfillLifeQueueItem(e, cfg, fulfill, now).extra;
  }
  return applyLifeMoodPeakBonus(e, cfg, prevMood, newMood).extra;
}

export function baseInteractBonusXp(kind: InteractKind): number {
  if (kind === "play") return 6;
  if (kind === "pet") return 5;
  if (kind === "toilet") return 4;
  if (kind === "calm") return 5;
  return 1;
}

export function resolveFulfillAction(kind: InteractKind): FulfillAction | null {
  if (kind === "play" || kind === "toilet" || kind === "calm") return kind;
  return null;
}

export function fallbackNextAvailableIso(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}
