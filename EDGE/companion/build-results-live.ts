import { resolveGiftLabel } from "../campaign/gifts-parse.js";
import type { PrizeWinnerRow } from "./prize-results-repo.js";

export type ResultsLiveWinnerPayload = {
  platformUserId: string;
  giftKey: string;
  giftLabel: string;
  /** Короткий псевдоним для экрана (без полного id). */
  anonLabel: string;
};

export type ResultsLivePayload = {
  drawBatchId: string;
  drawnAt: string;
  winners: ResultsLiveWinnerPayload[];
};

function maskUserId(id: string): string {
  const t = id.trim();
  if (t.length <= 6) return "•••";
  return `···${t.slice(-4)}`;
}

export function buildResultsLivePayload(
  giftsJson: unknown,
  pack: { drawBatchId: string; drawnAt: string; rows: PrizeWinnerRow[] } | null,
): ResultsLivePayload | null {
  if (!pack || pack.rows.length === 0) return null;
  const winners: ResultsLiveWinnerPayload[] = pack.rows.map((r) => {
    const platformUserId = r.platform_user_id;
    const giftKey = r.gift_key || "default";
    const giftLabel = resolveGiftLabel(giftsJson, giftKey);
    return {
      platformUserId,
      giftKey,
      giftLabel,
      anonLabel: maskUserId(platformUserId),
    };
  });
  return { drawBatchId: pack.drawBatchId, drawnAt: pack.drawnAt, winners };
}
