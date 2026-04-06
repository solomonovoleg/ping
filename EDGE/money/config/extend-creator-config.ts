import type { CampaignEdgeType } from "./campaign-edge-type.js";
import { asRecord } from "./as-record.js";
import { defaultMoneyConfigSection } from "./defaults.js";

/**
 * Для кампаний типа `money` подмешивает `config_json.money` и порядок surfaces без персонажа.
 */
export function applyMoneyDefaultsIfNeeded(
  edgeType: CampaignEdgeType,
  base: Record<string, unknown>,
): Record<string, unknown> {
  if (edgeType !== "money") return base;
  const companion = { ...asRecord(base.companion) };
  companion.surfaceOrder = ["info", "leaderboard", "results", "prizes"];
  return {
    ...base,
    companion,
    money: defaultMoneyConfigSection(),
  };
}
