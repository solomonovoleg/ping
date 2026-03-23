import { useMemo } from "react";
import { motion } from "framer-motion";
import type { EdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { CompanionSurfacePager } from "@/features/edge-companion/companion-surfaces/CompanionSurfacePager";
import {
  initialSurfaceIndex,
  resolveVisibleSurfaces,
} from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import { COMPANION_SURFACE_LABEL } from "@/features/edge-companion/companion-surfaces/surface-labels";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";

type Props = {
  edgeCampaignId: string;
  campaign: EdgeCompanionCampaignConfig;
  onActiveSurfaceLabel?: (label: string) => void;
};

export function EdgeCompanionCampaignShell({
  edgeCampaignId,
  campaign,
  onActiveSurfaceLabel,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
  const interactLocked = Boolean(campaign.interactLocked);
  const visible = useMemo(
    () =>
      resolveVisibleSurfaces({
        ui,
        edgeType: campaign.edgeType,
        leaderboardEnabled: Boolean(campaign.leaderboard?.globalEnabled),
      }),
    [ui, campaign.edgeType, campaign.leaderboard?.globalEnabled],
  );
  const startIndex = useMemo(() => initialSurfaceIndex(visible), [visible]);
  const templates = campaign.gifts?.templates ?? [];

  return (
    <motion.div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
    >
      <CompanionSurfacePager
        key={edgeCampaignId}
        edgeId={edgeCampaignId}
        campaignTitle={campaign.title}
        visible={visible}
        startIndex={startIndex}
        companionUi={ui}
        giftTemplates={templates}
        resultsLive={campaign.resultsLive ?? null}
        interactLocked={interactLocked}
        taskPresets={campaign.taskPresets ?? []}
        onActiveSurfaceChange={(_idx, id) => onActiveSurfaceLabel?.(COMPANION_SURFACE_LABEL[id])}
      />
    </motion.div>
  );
}
