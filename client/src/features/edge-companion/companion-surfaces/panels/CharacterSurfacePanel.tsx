import { EdgeParticipantPetCard } from "@/features/edge-companion/components/EdgeParticipantPetCard";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import type { CompanionCharacterConfig } from "../types";

type Props = {
  edgeId: string;
  campaignTitle: string;
  character: CompanionCharacterConfig | null;
  interactLocked?: boolean;
  taskPresets?: EdgeTaskPresetPublic[];
  giftTemplates?: unknown[];
};

/**
 * Центральный экран: тот же макет, что в посте (призы · персонаж · метрики), затем уход и задания.
 * Остальные экраны EDGE — свайпом по карусели (лидерборд, призы, статья, итоги).
 */
export function CharacterSurfacePanel({
  edgeId,
  campaignTitle,
  character,
  interactLocked,
  taskPresets,
  giftTemplates = [],
}: Props) {
  return (
    <div className="uix-content-x box-border min-h-full pb-[var(--uix-space-6)] pt-[var(--uix-space-2)]">
      <EdgeParticipantPetCard
        edgeId={edgeId}
        campaignTitle={campaignTitle}
        character={character}
        interactLocked={interactLocked}
        taskPresets={taskPresets}
        giftTemplates={giftTemplates}
      />
    </div>
  );
}
