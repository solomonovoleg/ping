import { normalizeCampaignEdgeType } from "../money/config/campaign-edge-type.js";
import { applyMoneyDefaultsIfNeeded } from "../money/config/extend-creator-config.js";
import { buildDefaultCreatorConfig } from "./merge-creator-config.js";

export function buildInitialConfigJsonForCampaign(edgeType: string): Record<string, unknown> {
  const et = normalizeCampaignEdgeType(edgeType);
  const base = buildDefaultCreatorConfig();
  return applyMoneyDefaultsIfNeeded(et, base);
}
