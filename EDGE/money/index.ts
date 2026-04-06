/**
 * EDGE MONEY — отдельный тип кампании (`edge_type = money`), конфиг в `config_json.money`.
 */
export type { MoneyConfigParsed, MoneyPrizeTier, MoneyScoringKind, MoneyScoringRule } from "./types/money-config.js";
export { normalizeCampaignEdgeType, type CampaignEdgeType } from "./config/campaign-edge-type.js";
export { applyMoneyDefaultsIfNeeded } from "./config/extend-creator-config.js";
export { parseMoneyConfigFromRoot } from "./config/parse-money-config.js";
export { createMoneyRouter } from "./http/routes.js";
