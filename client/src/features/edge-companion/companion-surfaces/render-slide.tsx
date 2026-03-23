import type { ReactNode } from "react";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { CompanionSurfaceId, CompanionUiPayload } from "./types";
import { CharacterSurfacePanel } from "./panels/CharacterSurfacePanel";
import { InfoArticleSurfacePanel } from "./panels/InfoArticleSurfacePanel";
import { LeaderboardSurfacePanel } from "./panels/LeaderboardSurfacePanel";
import { ResultsSurfacePanel } from "./panels/ResultsSurfacePanel";
import { PrizesSurfacePanel } from "./panels/PrizesSurfacePanel";

type Props = {
  id: CompanionSurfaceId;
  edgeId: string;
  campaignTitle: string;
  ui: CompanionUiPayload;
  giftTemplates: unknown[];
  resultsLive: ResultsLivePayload | null | undefined;
  interactLocked?: boolean;
  taskPresets?: EdgeTaskPresetPublic[];
};

export function renderCompanionSlide({
  id,
  edgeId,
  campaignTitle,
  ui,
  giftTemplates,
  resultsLive,
  interactLocked = false,
  taskPresets = [],
}: Props): ReactNode {
  switch (id) {
    case "character":
      return (
        <CharacterSurfacePanel
          edgeId={edgeId}
          campaignTitle={campaignTitle}
          character={ui.character}
          interactLocked={interactLocked}
          taskPresets={taskPresets}
          giftTemplates={giftTemplates}
        />
      );
    case "info":
      return <InfoArticleSurfacePanel article={ui.infoArticle} campaignTitle={campaignTitle} />;
    case "leaderboard":
      return <LeaderboardSurfacePanel edgeId={edgeId} />;
    case "results":
      return <ResultsSurfacePanel staticConfig={ui.results} live={resultsLive ?? null} />;
    case "prizes":
      return <PrizesSurfacePanel templates={giftTemplates} />;
    default:
      return null;
  }
}
