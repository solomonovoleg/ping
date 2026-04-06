/** Синхронно с `EDGE/companion/campaign-ui-config.ts` и ответом campaign-config. */

export type CompanionSurfaceId =
  | "tasks"
  | "character"
  | "info"
  | "leaderboard"
  | "leaderboardSecondary"
  | "results"
  | "prizes";

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
  /**
   * Непустой массив — только эти экраны и в этом порядке (вкл/выкл из админки).
   * Иначе: прежний режим, `surfaceOrder` переупорядочивает, остальные id дописываются на EDGE.
   */
  onlySurfaces?: CompanionSurfaceId[] | null;
  infoArticle: CompanionInfoArticle | null;
  results: CompanionResultsConfig | null;
  /** PNG персонажа и имя для людей — с Борда или админки. */
  character: CompanionCharacterConfig | null;
};
