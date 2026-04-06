import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { EDGE_HORIZONTAL_CAROUSEL_OPTIONS } from "@/features/edge-companion/edge-embla-scroll";
import { useEmblaViewportHeightSync } from "@/features/edge-companion/use-embla-viewport-height-sync";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import type { CompanionSurfaceId, CompanionUiPayload } from "./types";
import { renderCompanionSlide } from "./render-slide";
import { CompanionSurfaceDots } from "./CompanionSurfaceDots";
import { EDGE_COMPANION_CHROME, EDGE_COMPANION_VIEWPORT } from "@/features/edge-companion/edge-uix";
import { tryRegisterIntroSurfaceSwipe } from "@/features/edge-companion/edge-intro-onboarding";
import { cn } from "@/lib/utils";

type Props = {
  edgeId: string;
  campaignTitle: string;
  visible: CompanionSurfaceId[];
  startIndex: number;
  companionUi: CompanionUiPayload;
  giftTemplates: unknown[];
  resultsLive?: ResultsLivePayload | null;
  interactLocked?: boolean;
  taskPresets?: EdgeTaskPresetPublic[];
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  /** Для онбординга «шаг 3 — свайп». */
  introTapCount?: number;
  onActiveSurfaceChange?: (index: number, id: CompanionSurfaceId) => void;
  participantState?: EdgeParticipantState;
};

export function CompanionSurfacePager({
  edgeId,
  campaignTitle,
  visible,
  startIndex,
  companionUi,
  giftTemplates,
  resultsLive,
  interactLocked = false,
  taskPresets = [],
  leaderboardPrimaryEnabled = true,
  leaderboardSecondaryEnabled = true,
  introTapCount = 0,
  onActiveSurfaceChange,
  participantState,
}: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    ...EDGE_HORIZONTAL_CAROUSEL_OPTIONS,
    watchDrag: true,
    dragFree: false,
  });
  const emblaViewportRef = useEmblaViewportHeightSync(emblaApi, emblaRef);
  const [selected, setSelected] = useState(startIndex);
  const prevSnap = useRef(-1);
  const mounted = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const introTapsRef = useRef(introTapCount);
  introTapsRef.current = introTapCount;

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const n = emblaApi.selectedScrollSnap();
    setSelected(n);
    onActiveSurfaceChange?.(n, visibleRef.current[n]!);
    if (mounted.current && prevSnap.current >= 0 && n !== prevSnap.current) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    prevSnap.current = n;
    tryRegisterIntroSurfaceSwipe(edgeId, introTapsRef.current, visibleRef.current, n);
  }, [emblaApi, edgeId, onActiveSurfaceChange]);

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

  return (
    <div className="flex w-full flex-col bg-background">
      <div className={`shrink-0 ${EDGE_COMPANION_CHROME}`}>
        <CompanionSurfaceDots visible={visible} selectedIndex={selected} onSelect={scrollTo} />
      </div>
      <div
        role="region"
        aria-label="Экраны кампании: свайп влево и вправо"
        className={cn("w-full overflow-hidden touch-pan-y", EDGE_COMPANION_VIEWPORT)}
        ref={emblaViewportRef}
        data-edge-companion-embla-viewport
      >
        <div className="flex items-start">
          {visible.map((id) => (
            <div
              key={id}
              className="box-border min-h-0 min-w-0 shrink-0 basis-full overflow-x-hidden pb-[var(--uix-space-4)]"
            >
              {renderCompanionSlide({
                id,
                edgeId,
                campaignTitle,
                ui: companionUi,
                giftTemplates,
                resultsLive,
                interactLocked,
                taskPresets,
                leaderboardPrimaryEnabled,
                leaderboardSecondaryEnabled,
                participantState,
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
