import { useMemo } from "react";
import { motion } from "framer-motion";
import type { EdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { EdgeInteractiveTemplate } from "@/features/edge-companion/interactive-template/EdgeInteractiveTemplate";
import { tabLabel } from "@/features/edge-companion/interactive-template/build-interactive-tabs";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import { resolveLeaderboardVisibility, resolveVisibleSurfaces } from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";

type Props = {
  edgeCampaignId: string;
  campaign: EdgeCompanionCampaignConfig;
  onBack: () => void;
  backAriaLabel: string;
  participantState: EdgeParticipantState | undefined;
  onParticipantState: (s: EdgeParticipantState) => void;
  onActiveSurfaceLabel?: (label: string) => void;
  introTapCount?: number;
};

export function EdgeCompanionCampaignShell({
  edgeCampaignId,
  campaign,
  onBack,
  backAriaLabel,
  participantState,
  onParticipantState,
  onActiveSurfaceLabel,
  introTapCount = 0,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
  const interactLocked = Boolean(campaign.interactLocked);
  const taskPresetsCount = (campaign.taskPresets ?? []).length;
  const { primaryOn, secondaryOn } = resolveLeaderboardVisibility(campaign.leaderboard);
  const visible = useMemo(
    () =>
      resolveVisibleSurfaces({
        ui,
        edgeType: campaign.edgeType,
        leaderboardPrimaryEnabled: primaryOn,
        leaderboardSecondaryEnabled: secondaryOn,
        taskPresetsCount,
      }),
    [ui, campaign.edgeType, primaryOn, secondaryOn, taskPresetsCount],
  );
  const templates = campaign.gifts?.templates ?? [];

  return (
    <motion.div
      className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
      initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
    >
      <EdgeInteractiveTemplate
        key={edgeCampaignId}
        edgeId={edgeCampaignId}
        campaignTitle={campaign.title}
        onBack={onBack}
        backAriaLabel={backAriaLabel}
        visible={visible}
        companionUi={ui}
        giftTemplates={templates}
        resultsLive={campaign.resultsLive ?? null}
        interactLocked={interactLocked}
        taskPresets={campaign.taskPresets ?? []}
        leaderboardPrimaryEnabled={primaryOn}
        leaderboardSecondaryEnabled={secondaryOn}
        introTapCount={introTapCount}
        participantState={participantState}
        onParticipantState={onParticipantState}
        pingInviteTemplate={campaign.pingInviteDm?.template ?? null}
        scheduleEndsAt={campaign.scheduleEndsAt ?? null}
        onActiveSurfaceChange={(_idx, id) => onActiveSurfaceLabel?.(tabLabel(id))}
      />
    </motion.div>
  );
}
