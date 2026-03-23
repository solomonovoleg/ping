import type { ReactNode } from "react";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
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
  /** Слот «персонаж» в ленте ренерится снаружи (отдельный макет). */
  characterSlot: ReactNode;
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
  characterSlot,
}: Props): ReactNode {
  if (id === "character") {
    return characterSlot;
  }
  return (
    <div className="box-border min-h-[260px] max-h-[min(70vh,420px)] overflow-y-auto overflow-x-hidden overscroll-y-contain px-1 [-webkit-overflow-scrolling:touch]">
      {renderCompanionSlide({
        id,
        edgeId,
        campaignTitle,
        ui,
        giftTemplates,
        resultsLive,
        interactLocked,
        taskPresets,
      })}
    </div>
  );
}
