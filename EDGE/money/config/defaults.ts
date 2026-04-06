import type { MoneyConfigParsed } from "../types/money-config.js";

/** Значения по умолчанию для новой кампании `edge_type = money`. */
export function defaultMoneyConfigSection(): MoneyConfigParsed {
  return {
    version: 1,
    headline: "",
    mediaUrl: null,
    scoringRules: [],
    prizeTiers: [],
    colorScheme: "default",
  };
}
