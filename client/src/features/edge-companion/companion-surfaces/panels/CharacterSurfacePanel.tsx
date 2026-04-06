import { EdgeParticipantPetCard } from "@/features/edge-companion/components/EdgeParticipantPetCard";
import type { CompanionCharacterConfig } from "../types";

type Props = {
  edgeId: string;
  campaignTitle: string;
  character: CompanionCharacterConfig | null;
  interactLocked?: boolean;
  /** Подсказка: задания на соседнем свайпе «Задания». */
  showTasksPagerHint?: boolean;
  giftTemplates?: unknown[];
};

/**
 * Центральный экран: тот же макет, что в посте (призы · персонаж · метрики).
 * Задания — отдельный свайп слева («Задания» в рейке сверху).
 */
export function CharacterSurfacePanel({
  edgeId,
  campaignTitle,
  character,
  interactLocked,
  showTasksPagerHint = false,
  giftTemplates = [],
}: Props) {
  return (
    <div className="uix-content-x box-border min-h-full pb-6 pt-1">
      <EdgeParticipantPetCard
        edgeId={edgeId}
        campaignTitle={campaignTitle}
        character={character}
        interactLocked={interactLocked}
        showTasksPagerHint={showTasksPagerHint}
        giftTemplates={giftTemplates}
      />
    </div>
  );
}
