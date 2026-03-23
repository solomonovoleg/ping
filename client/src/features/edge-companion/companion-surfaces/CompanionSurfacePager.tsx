import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { CompanionSurfaceId, CompanionUiPayload } from "./types";
import { renderCompanionSlide } from "./render-slide";
import { CompanionSurfaceDots } from "./CompanionSurfaceDots";
import { buildEdgeFeedSwipeHint, EdgeFeedSwipeHintRow } from "@/features/edge-companion/feed-delight";

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
  onActiveSurfaceChange?: (index: number, id: CompanionSurfaceId) => void;
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
  onActiveSurfaceChange,
}: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [selected, setSelected] = useState(startIndex);
  const swipeHintText = useMemo(() => buildEdgeFeedSwipeHint(visible, selected), [visible, selected]);
  const prevSnap = useRef(-1);
  const mounted = useRef(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const n = emblaApi.selectedScrollSnap();
    setSelected(n);
    onActiveSurfaceChange?.(n, visible[n]!);
    if (mounted.current && prevSnap.current >= 0 && n !== prevSnap.current) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    prevSnap.current = n;
  }, [emblaApi, onActiveSurfaceChange, visible]);

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
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="shrink-0 border-b border-border/10">
        <CompanionSurfaceDots visible={visible} selectedIndex={selected} onSelect={scrollTo} />
        <EdgeFeedSwipeHintRow text={swipeHintText} />
      </div>
      <div className="touch-pan-x min-h-0 flex-1 overflow-hidden bg-background" ref={emblaRef}>
        <div className="flex h-full">
          {visible.map((id) => (
            <div
              key={id}
              className="box-border h-full min-h-0 min-w-0 shrink-0 basis-full overflow-y-auto overflow-x-hidden overscroll-y-contain [touch-action:pan-y]"
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
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
