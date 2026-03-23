/** Синхронно с `EDGE/companion/campaign-ui-config.ts` и ответом campaign-config. */

export type CompanionSurfaceId = "character" | "info" | "leaderboard" | "results" | "prizes";

export type CompanionInfoBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "video"; url: string };

export type CompanionInfoArticle = {
  title?: string;
  blocks: CompanionInfoBlock[];
};

export type CompanionResultsConfig = {
  lastDrawSummary?: string;
  nextDrawHint?: string;
  winners?: { title?: string; name: string }[];
};

export type CompanionCharacterConfig = {
  assetUrl: string;
  displayName: string;
};

export type CompanionUiPayload = {
  surfaceOrder: CompanionSurfaceId[];
  infoArticle: CompanionInfoArticle | null;
  results: CompanionResultsConfig | null;
  /** PNG персонажа и имя для людей — с Борда или админки. */
  character: CompanionCharacterConfig | null;
};
