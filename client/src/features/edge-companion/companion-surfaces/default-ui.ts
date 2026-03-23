import type { CompanionUiPayload } from "./types";

/** Если EDGE старый или поле не пришло — дефолтный порядок свайп-экранов. */
export const DEFAULT_COMPANION_UI: CompanionUiPayload = {
  surfaceOrder: ["character", "info", "leaderboard", "results", "prizes"],
  infoArticle: null,
  results: null,
  character: null,
};
