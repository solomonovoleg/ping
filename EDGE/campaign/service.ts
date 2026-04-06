import { randomInt, randomUUID } from "node:crypto";
import { getEdgePool } from "../db/pool.js";
import { ensureEdgeCampaign, findCampaignByPublicId } from "../companion/repo.js";
import { insertPrizeWinners, listWinnerUserIdsForGift } from "./repo.js";
import { countWinnersForGift, listOrderedParticipantPool } from "./draw-eligible.js";
import {
  giftLeaderboardFreezeTargetsForKey,
  giftQuantityForKey,
  resolveGiftLabel,
  winnerDmForGiftKey,
} from "./gifts-parse.js";
import { parsePrizeRulesFromConfig, type ParsedPrizeRules } from "./prize-rules-parse.js";
import type { DrawPrizeResponse } from "./types.js";

export type PrizeDrawRulesOverride = Partial<
  Pick<ParsedPrizeRules, "pool" | "topN" | "method" | "rankingKind">
>;

/** Разбор переопределения правил из тела POST /v1/campaign/draw или creator prize-draw. */
export function parsePrizeDrawRulesOverrideFromBody(body: unknown): PrizeDrawRulesOverride | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const o = body as Record<string, unknown>;
  const out: PrizeDrawRulesOverride = {};
  if (o.pool === "top" || o.pool === "all") out.pool = o.pool;
  if (o.method === "first" || o.method === "random") out.method = o.method;
  if (o.topN !== undefined && o.topN !== null) {
    const n = Number(o.topN);
    if (Number.isFinite(n)) out.topN = n;
  }
  if (o.rankingKind === "primary" || o.rankingKind === "secondary") {
    out.rankingKind = o.rankingKind;
  } else if (o.rankingScope === "primary" || o.rankingScope === "secondary") {
    out.rankingKind = o.rankingScope;
  }
  return Object.keys(out).length ? out : undefined;
}

function mergePrizeRules(
  base: ParsedPrizeRules,
  override: PrizeDrawRulesOverride | undefined,
): ParsedPrizeRules {
  if (!override) return base;
  const pool = override.pool === "top" || override.pool === "all" ? override.pool : base.pool;
  const method = override.method === "first" || override.method === "random" ? override.method : base.method;
  let topN = base.topN;
  if (override.topN !== undefined) {
    const n = Math.floor(Number(override.topN));
    if (Number.isFinite(n)) topN = Math.min(5000, Math.max(1, n));
  }
  const rankingKind =
    override.rankingKind === "secondary" || override.rankingKind === "primary"
      ? override.rankingKind
      : base.rankingKind;
  return { pool, method, topN, rankingKind };
}

function pickRandomUnique(ids: string[], n: number): string[] {
  const pool = [...ids];
  const out: string[] = [];
  const take = Math.min(n, pool.length);
  for (let i = 0; i < take; i++) {
    const j = randomInt(0, pool.length);
    const id = pool.splice(j, 1)[0]!;
    out.push(id);
  }
  return out;
}

function pickFirstN(ids: string[], n: number): string[] {
  return ids.slice(0, Math.min(n, ids.length));
}

export type RunDrawResult =
  | { ok: true; payload: DrawPrizeResponse }
  | { ok: false; error: "edge_db_unavailable" | "campaign_not_found" | "no_eligible_participants" };

export async function runPrizeDraw(params: {
  edgeId: string;
  giftKey?: string;
  count?: number;
  rulesOverride?: PrizeDrawRulesOverride;
}): Promise<RunDrawResult> {
  const pool = getEdgePool();
  if (!pool) return { ok: false, error: "edge_db_unavailable" };

  const edgeId = String(params.edgeId ?? "").trim();
  if (!edgeId) return { ok: false, error: "campaign_not_found" };

  await ensureEdgeCampaign(edgeId);
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };

  const giftKey = String(params.giftKey ?? "default").trim() || "default";
  let requestedCount = Math.min(50, Math.max(1, Math.floor(Number(params.count) || 1)));

  const rules = mergePrizeRules(parsePrizeRulesFromConfig(campaign.config_json), params.rulesOverride);
  const orderedPool = await listOrderedParticipantPool(
    edgeId,
    rules.pool,
    rules.topN,
    rules.rankingKind,
  );
  if (orderedPool === null) return { ok: false, error: "edge_db_unavailable" };

  const already = await listWinnerUserIdsForGift(edgeId, giftKey);
  if (already === null) return { ok: false, error: "edge_db_unavailable" };

  const wonSoFar = await countWinnersForGift(edgeId, giftKey);
  if (wonSoFar === null) return { ok: false, error: "edge_db_unavailable" };

  const giftCap = giftQuantityForKey(campaign.gifts_json, giftKey);
  const remainingGiftSlots = giftCap != null ? Math.max(0, giftCap - wonSoFar) : 9999;
  if (remainingGiftSlots <= 0) return { ok: false, error: "no_eligible_participants" };

  requestedCount = Math.min(requestedCount, remainingGiftSlots);

  const eligible = orderedPool.filter((id) => !already.has(id));
  if (eligible.length === 0) return { ok: false, error: "no_eligible_participants" };

  const picked =
    rules.method === "first" ? pickFirstN(eligible, requestedCount) : pickRandomUnique(eligible, requestedCount);
  const drawBatchId = randomUUID();
  const ok = await insertPrizeWinners(edgeId, giftKey, drawBatchId, picked);
  if (!ok) return { ok: false, error: "edge_db_unavailable" };

  const targets = giftLeaderboardFreezeTargetsForKey(campaign.gifts_json, giftKey);
  try {
    await pool.query(
      `UPDATE edge_campaigns SET
         primary_leaderboard_frozen_at = CASE WHEN $2::boolean THEN now() ELSE primary_leaderboard_frozen_at END,
         secondary_leaderboard_frozen_at = CASE WHEN $3::boolean THEN now() ELSE secondary_leaderboard_frozen_at END,
         updated_at = now()
       WHERE public_id = $1`,
      [edgeId, targets.freezePrimary, targets.freezeSecondary],
    );
  } catch (e) {
    console.error("[edge] runPrizeDraw freeze columns", e);
  }

  const giftLabel = resolveGiftLabel(campaign.gifts_json, giftKey);
  const winners = picked.map((platformUserId) => ({
    platformUserId,
    giftKey,
    giftLabel,
  }));

  const dmTpl = winnerDmForGiftKey(campaign.gifts_json, giftKey);
  const winnerDm =
    dmTpl && dmTpl.enabled ? { text: dmTpl.text, mediaUrl: dmTpl.mediaUrl } : null;

  return {
    ok: true,
    payload: {
      edgeId,
      campaignTitle: campaign.title.trim() || "Кампания EDGE",
      drawBatchId,
      creatorPlatformUserId: campaign.creator_platform_user_id,
      giftKey,
      giftLabel,
      poolSize: eligible.length,
      requestedCount,
      drawnCount: winners.length,
      winners,
      winnerDm,
    },
  };
}
