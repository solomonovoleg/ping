import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";
import { CompanionSurfaceDots } from "@/features/edge-companion/companion-surfaces/CompanionSurfaceDots";
import { renderFeedCompanionSlide } from "@/features/edge-companion/companion-surfaces/render-feed-slide";
import {
  initialSurfaceIndex,
  resolveVisibleSurfaces,
} from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import type { CompanionSurfaceId } from "@/features/edge-companion/companion-surfaces/types";
import { EdgeFeedCharacterSlide } from "./EdgeFeedCharacterSlide";
import { usePrefersReducedMotion } from "@/lib/motion";
import { buildEdgeFeedSwipeHint, EdgeFeedSwipeHintRow } from "@/features/edge-companion/feed-delight";

type Props = {
  edgeId: string;
  campaign: EdgeCompanionCampaignConfig;
  stats: EdgeParticipantState | undefined;
  isGuest: boolean;
  stateLoading: boolean;
  stateError: boolean;
  locked: boolean;
};

/**
 * Горизонтальные экраны EDGE внутри поста. Жесты не всплывают к родителю — чтобы не переключать вкладки приложения.
 */
export function EdgeFeedSurfacePager({
  edgeId,
  campaign,
  stats,
  isGuest,
  stateLoading,
  stateError,
  locked,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
  const templates = campaign.gifts?.templates ?? [];
  const title = campaign.title?.trim() || "Кампания EDGE";

  const visible = resolveVisibleSurfaces({
    ui,
    edgeType: campaign.edgeType,
    leaderboardEnabled: Boolean(campaign.leaderboard?.globalEnabled),
  });
  const startIndex = initialSurfaceIndex(visible);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "start",
    watchDrag: true,
    dragFree: false,
  });
  const [selected, setSelected] = useState(startIndex);
  const swipeHintText = useMemo(() => buildEdgeFeedSwipeHint(visible, selected), [visible, selected]);
  const prevSnap = useRef(-1);
  const mounted = useRef(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const n = emblaApi.selectedScrollSnap();
    setSelected(n);
    if (mounted.current && prevSnap.current >= 0 && n !== prevSnap.current) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    prevSnap.current = n;
  }, [emblaApi]);

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const id = window.setTimeout(() => {
      emblaApi.reInit();
      emblaApi.scrollTo(Math.min(startIndex, visible.length - 1), true);
    }, 0);
    return () => clearTimeout(id);
  }, [emblaApi, startIndex, visible.length]);

  const scrollTo = useCallback(
    (i: number) => {
      emblaApi?.scrollTo(i);
    },
    [emblaApi],
  );

  const characterSlot = (
    <EdgeFeedCharacterSlide
      edgeId={edgeId}
      character={ui.character}
      templates={templates}
      stats={stats}
      isGuest={isGuest}
      stateLoading={stateLoading}
      stateError={stateError}
      locked={locked}
      reducedMotion={reducedMotion}
    />
  );

  return (
    <div
      className="mt-3 min-w-0 isolate overscroll-x-contain"
      data-edge-feed-pager
      onPointerDownCapture={(e) => e.stopPropagation()}
      onTouchStartCapture={(e) => e.stopPropagation()}
    >
      <div className="border-b border-border/10 bg-transparent">
        <CompanionSurfaceDots visible={visible} selectedIndex={selected} onSelect={scrollTo} />
        <EdgeFeedSwipeHintRow text={swipeHintText} />
      </div>
      <div className="touch-pan-x overflow-hidden bg-transparent" ref={emblaRef}>
        <div className="flex">
          {visible.map((id: CompanionSurfaceId) => (
            <div key={id} className="min-w-0 shrink-0 grow-0 basis-full">
              {renderFeedCompanionSlide({
                id,
                edgeId,
                campaignTitle: title,
                ui,
                giftTemplates: templates,
                resultsLive: campaign.resultsLive ?? null,
                interactLocked: locked,
                taskPresets: campaign.taskPresets ?? [],
                characterSlot,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
