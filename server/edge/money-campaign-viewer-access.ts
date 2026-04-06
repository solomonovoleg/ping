import type { Response } from "express";
import { normalizeEdgeDisplayAudience } from "../posts/edge-display-audience";
import { storage } from "../storage";

/**
 * Те же правила, что у `GET /api/edge/money/campaign-config`: self / followers / public.
 * При отказе отправляет 404 и возвращает false.
 */
export async function ensureMoneyCampaignJsonVisibleToViewer(
  bodyJson: string,
  viewerId: string | null,
  res: Response,
): Promise<boolean> {
  try {
    const parsed = JSON.parse(bodyJson) as {
      displayAudience?: unknown;
      creatorPlatformUserId?: unknown;
    };
    const aud = normalizeEdgeDisplayAudience(
      typeof parsed.displayAudience === "string" ? parsed.displayAudience : undefined,
    );
    const creatorId =
      typeof parsed.creatorPlatformUserId === "string" ? parsed.creatorPlatformUserId.trim() : "";
    if (aud === "self") {
      if (!viewerId || viewerId !== creatorId) {
        res.status(404).json({ error: "edge_campaign_not_found" });
        return false;
      }
    } else if (aud === "followers") {
      if (!creatorId) {
        res.status(404).json({ error: "edge_campaign_not_found" });
        return false;
      }
      if (!viewerId || (viewerId !== creatorId && !(await storage.isFollowing(viewerId, creatorId)))) {
        res.status(404).json({ error: "edge_campaign_not_found" });
        return false;
      }
    }
  } catch {
    /* битый JSON — не режем (как в маршруте campaign-config) */
  }
  return true;
}
