import { randomInt, randomUUID } from "node:crypto";
import { getEdgePool } from "../db/pool.js";
import { ensureEdgeCampaign, findCampaignByPublicId } from "../companion/repo.js";
import { insertPrizeWinners, listWinnerUserIdsForGift } from "./repo.js";
import { countWinnersForGift, listOrderedParticipantPool } from "./draw-eligible.js";
import { giftQuantityForKey, resolveGiftLabel } from "./gifts-parse.js";
import { parsePrizeRulesFromConfig } from "./prize-rules-parse.js";
import type { DrawPrizeResponse } from "./types.js";

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
}): Promise<RunDrawResult> {
  if (!getEdgePool()) return { ok: false, error: "edge_db_unavailable" };

  const edgeId = String(params.edgeId ?? "").trim();
  if (!edgeId) return { ok: false, error: "campaign_not_found" };

  await ensureEdgeCampaign(edgeId);
  const campaign = await findCampaignByPublicId(edgeId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };

  const giftKey = String(params.giftKey ?? "default").trim() || "default";
  let requestedCount = Math.min(50, Math.max(1, Math.floor(Number(params.count) || 1)));

  const rules = parsePrizeRulesFromConfig(campaign.config_json);
  const orderedPool = await listOrderedParticipantPool(edgeId, rules.pool, rules.topN);
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

  const giftLabel = resolveGiftLabel(campaign.gifts_json, giftKey);
  const winners = picked.map((platformUserId) => ({
    platformUserId,
    giftKey,
    giftLabel,
  }));

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
    },
  };
}
