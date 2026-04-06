import type { ReactNode } from "react";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import type { CompanionSurfaceId, CompanionUiPayload } from "./types";
import { CharacterSurfacePanel } from "./panels/CharacterSurfacePanel";
import { TasksSurfacePanel } from "./panels/TasksSurfacePanel";
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
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  participantState?: EdgeParticipantState;
  /** Вложенный превью-блок в посте — компактнее экран «Задания». */
  embedVariant?: "full" | "feed";
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
  leaderboardPrimaryEnabled = true,
  leaderboardSecondaryEnabled = true,
  participantState,
  embedVariant = "full",
}: Props): ReactNode {
  switch (id) {
    case "tasks":
      return (
        <TasksSurfacePanel
          edgeId={edgeId}
          presets={taskPresets}
          interactLocked={interactLocked}
          leaderboardPrimaryEnabled={leaderboardPrimaryEnabled}
          leaderboardSecondaryEnabled={leaderboardSecondaryEnabled}
          participantState={participantState}
          embedVariant={embedVariant}
        />
      );
    case "character":
      return (
        <CharacterSurfacePanel
          edgeId={edgeId}
          campaignTitle={campaignTitle}
          character={ui.character}
          interactLocked={interactLocked}
          showTasksPagerHint={taskPresets.length > 0}
          giftTemplates={giftTemplates}
        />
      );
    case "info":
      return <InfoArticleSurfacePanel article={ui.infoArticle} campaignTitle={campaignTitle} />;
    case "leaderboard":
      return <LeaderboardSurfacePanel edgeId={edgeId} kind="primary" />;
    case "leaderboardSecondary":
      return <LeaderboardSurfacePanel edgeId={edgeId} kind="secondary" />;
    case "results":
      return <ResultsSurfacePanel staticConfig={ui.results} live={resultsLive ?? null} />;
    case "prizes":
      return <PrizesSurfacePanel templates={giftTemplates} />;
    default:
      return null;
  }
}
