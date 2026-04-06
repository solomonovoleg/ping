import type { ReactNode } from "react";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import type { CompanionSurfaceId, CompanionUiPayload } from "./types";
import { renderCompanionSlide } from "./render-slide";

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
  /** Слот «персонаж» в ленте ренерится снаружи (отдельный макет). */
  characterSlot: ReactNode;
  participantState?: EdgeParticipantState;
  /** Пробрасывается в `TasksSurfacePanel` для компактного hero в карточке ленты. */
  embedVariant?: "full" | "feed";
};

/**
 * Слайды EDGE внутри поста: тот же контент, что полноэкранный companion, но в ограниченной высоте.
 * Экран `character` подменяется на кастомный feed-макет.
 */
export function renderFeedCompanionSlide({
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
  characterSlot,
  participantState,
  embedVariant = "feed",
}: Props): ReactNode {
  if (id === "character") {
    return characterSlot;
  }
  return (
    <div className="box-border min-h-0 w-full px-1 pb-1">
      {renderCompanionSlide({
        id,
        edgeId,
        campaignTitle,
        ui,
        giftTemplates,
        resultsLive,
        interactLocked,
        taskPresets,
        leaderboardPrimaryEnabled,
        leaderboardSecondaryEnabled,
        participantState,
        embedVariant,
      })}
    </div>
  );
}
