import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { EdgeCompanionCampaignConfig } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import { DEFAULT_COMPANION_UI } from "@/features/edge-companion/companion-surfaces/default-ui";
import { renderFeedCompanionSlide } from "@/features/edge-companion/companion-surfaces/render-feed-slide";
import {
  initialSurfaceIndex,
  resolveLeaderboardVisibility,
  resolveVisibleSurfaces,
} from "@/features/edge-companion/companion-surfaces/resolve-visible-surfaces";
import type { CompanionSurfaceId } from "@/features/edge-companion/companion-surfaces/types";
import { EdgeFeedCharacterSlide } from "./EdgeFeedCharacterSlide";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { EDGE_HORIZONTAL_CAROUSEL_OPTIONS } from "@/features/edge-companion/edge-embla-scroll";
import { useEmblaViewportHeightSync } from "@/features/edge-companion/use-embla-viewport-height-sync";
import { cn } from "@/lib/utils";
import { EdgeIntroFootnote } from "@/features/edge-companion/components/EdgeIntroFootnote";
import { tryRegisterIntroSurfaceSwipe } from "@/features/edge-companion/edge-intro-onboarding";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";

type Props = {
  edgeId: string;
  campaign: EdgeCompanionCampaignConfig;
  stats: EdgeParticipantState | undefined;
  isGuest: boolean;
  stateLoading: boolean;
  stateError: boolean;
  locked: boolean;
  onOpenGame: () => void;
  openGameLabel: string;
  openGameDisabled: boolean;
  ctaAccent?: boolean;
};

const PULSE_DURATION_S = DURATION_NORMAL_S * 2.25;

/** Стрелки по бокам: тонкие, с лёгким пульсом (свайп). */
function EdgeFeedSwipePulseArrow({
  direction,
  active,
  reducedMotion,
  onPress,
}: {
  direction: "prev" | "next";
  active: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const label = direction === "prev" ? "Предыдущий экран" : "Следующий экран";

  const inner = (
    <Icon
      className={cn(
        "h-3.5 w-3.5 text-primary/55 sm:h-4 sm:w-4",
        !active && "text-muted-foreground/20",
      )}
      strokeWidth={1.65}
      aria-hidden
    />
  );

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) return;
        triggerTapFeedback({ haptic: true, sound: true });
        onPress();
      }}
      disabled={!active}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity",
        active ? "opacity-100 hover:bg-foreground/[0.04]" : "cursor-default opacity-40",
      )}
    >
      {reducedMotion || !active ? (
        inner
      ) : (
        <motion.span
          className="flex items-center justify-center"
          animate={{
            opacity: [0.45, 1, 0.45],
            scale: [0.94, 1.02, 0.94],
          }}
          transition={{
            duration: PULSE_DURATION_S,
            repeat: Infinity,
            ease: EASING_OUT_BEZIER,
          }}
        >
          {inner}
        </motion.span>
      )}
    </button>
  );
}

/** Тонкие черточки — по числу экранов; активная «светится». */
function EdgeFeedScreenTicks({
  count,
  selectedIndex,
}: {
  count: number;
  selectedIndex: number;
}) {
  if (count <= 0) return null;
  return (
    <div
      className="flex min-h-[6px] flex-1 items-center justify-center gap-[5px] px-1"
      role="tablist"
      aria-label="Экраны превью кампании"
    >
      {Array.from({ length: count }, (_, i) => {
        const on = i === selectedIndex;
        return (
          <span
            key={i}
            role="presentation"
            className={cn(
              "rounded-full transition-all duration-300",
              on
                ? "h-[2px] w-[18px] bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.55),0_0_20px_hsl(var(--primary)/0.2)]"
                : "h-px w-[10px] bg-muted-foreground/35",
            )}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

/**
 * Горизонтальные экраны EDGE внутри поста. В ленте: ряд индикаторов + стрелки (полный экран — рейка в CompanionSurfacePager).
 */
export function EdgeFeedSurfacePager({
  edgeId,
  campaign,
  stats,
  isGuest,
  stateLoading,
  stateError,
  locked,
  onOpenGame,
  openGameLabel,
  openGameDisabled,
  ctaAccent = false,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const ui = campaign.companionUi ?? DEFAULT_COMPANION_UI;
  const templates = campaign.gifts?.templates ?? [];
  const title = campaign.title?.trim() || "Интерактивная кампания";

  const taskPresetsCount = (campaign.taskPresets ?? []).length;
  const { primaryOn, secondaryOn } = resolveLeaderboardVisibility(campaign.leaderboard);
  const visible = resolveVisibleSurfaces({
    ui,
    edgeType: campaign.edgeType,
    leaderboardPrimaryEnabled: primaryOn,
    leaderboardSecondaryEnabled: secondaryOn,
    taskPresetsCount,
  });
  const startIndex = initialSurfaceIndex(visible);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    ...EDGE_HORIZONTAL_CAROUSEL_OPTIONS,
    watchDrag: true,
    dragFree: false,
  });
  const characterSlideIndex = visible.indexOf("character");
  const emblaViewportRef = useEmblaViewportHeightSync(
    emblaApi,
    emblaRef,
    characterSlideIndex >= 0 ? characterSlideIndex : undefined,
  );
  const [selected, setSelected] = useState(startIndex);
  const [edgeScroll, setEdgeScroll] = useState({ prev: false, next: false });
  const prevSnap = useRef(-1);
  const suppressSelectFeedbackRef = useRef(false);
  const mounted = useRef(false);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const introTapsRef = useRef(stats?.introTapCount ?? 0);
  introTapsRef.current = stats?.introTapCount ?? 0;

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const n = emblaApi.selectedScrollSnap();
    setSelected(n);
    setEdgeScroll({ prev: emblaApi.canScrollPrev(), next: emblaApi.canScrollNext() });
    if (mounted.current && prevSnap.current >= 0 && n !== prevSnap.current) {
      if (suppressSelectFeedbackRef.current) {
        suppressSelectFeedbackRef.current = false;
      } else {
        triggerTapFeedback({ haptic: true, sound: !reducedMotion });
      }
    }
    prevSnap.current = n;
    tryRegisterIntroSurfaceSwipe(edgeId, introTapsRef.current, visibleRef.current, n);
  }, [emblaApi, edgeId, reducedMotion]);

  const scrollPrev = useCallback(() => {
    suppressSelectFeedbackRef.current = true;
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    suppressSelectFeedbackRef.current = true;
    emblaApi?.scrollNext();
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

  const characterSlot = (
    <EdgeFeedCharacterSlide
      variant="feed"
      edgeId={edgeId}
      campaignTitle={title}
      character={ui.character}
      templates={templates}
      stats={stats}
      isGuest={isGuest}
      stateLoading={stateLoading}
      stateError={stateError}
      locked={locked}
      reducedMotion={reducedMotion}
      onOpenGame={onOpenGame}
      openGameLabel={openGameLabel}
      openGameDisabled={openGameDisabled}
      ctaAccent={ctaAccent}
    />
  );

  const onNonCharacter = visible[selected] !== "character";
  const showControls = visible.length > 1;
  const noSurfaces = visible.length === 0;

  return (
    <div className="min-w-0 isolate overscroll-x-contain" data-edge-feed-pager>
      {noSurfaces ? (
        <ListEmptyState
          icon={Sparkles}
          title="Нет слайдов для ленты"
          description="Для этой кампании пока не настроены дополнительные сцены. Откройте игру ниже."
          actionLabel={openGameLabel}
          onAction={openGameDisabled ? undefined : onOpenGame}
          className="min-h-[220px] rounded-2xl border border-border/45 bg-card/35"
        />
      ) : null}
      {!isGuest && !locked ? (
        <div className="mb-1.5">
          <EdgeIntroFootnote
            edgeId={edgeId}
            introTapCount={stats?.introTapCount}
            layout="feed"
            hasMultipleSurfaces={visible.length > 1}
          />
        </div>
      ) : null}
      {!noSurfaces && showControls ? (
        <div className="flex items-center gap-0.5 pb-[3px] pt-0 sm:gap-1">
          <EdgeFeedSwipePulseArrow
            direction="prev"
            active={edgeScroll.prev}
            reducedMotion={reducedMotion}
            onPress={scrollPrev}
          />
          <EdgeFeedScreenTicks count={visible.length} selectedIndex={selected} />
          <EdgeFeedSwipePulseArrow
            direction="next"
            active={edgeScroll.next}
            reducedMotion={reducedMotion}
            onPress={scrollNext}
          />
        </div>
      ) : null}

      {!noSurfaces ? (
      <div className="relative overflow-hidden rounded-2xl bg-transparent">
        <div
          role="region"
          aria-label="Слайды EDGE: свайп влево и вправо"
          className="overflow-hidden bg-transparent touch-pan-y"
          ref={emblaViewportRef}
          data-edge-feed-embla-viewport
        >
          <div className="flex items-start">
            {visible.map((id: CompanionSurfaceId) => (
              <div key={id} className="min-h-0 min-w-0 shrink-0 grow-0 basis-full">
                {renderFeedCompanionSlide({
                  id,
                  edgeId,
                  campaignTitle: title,
                  ui,
                  giftTemplates: templates,
                  resultsLive: campaign.resultsLive ?? null,
                  interactLocked: locked,
                  taskPresets: campaign.taskPresets ?? [],
                  leaderboardPrimaryEnabled: primaryOn,
                  leaderboardSecondaryEnabled: secondaryOn,
                  characterSlot,
                  participantState: stats,
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : null}

      {!noSurfaces && onNonCharacter ? (
        <div className="mt-2 flex justify-center px-1">
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={onOpenGame}
            disabled={openGameDisabled}
            className="min-h-[var(--uix-touch-min)] rounded-lg px-3 text-[12px] font-semibold text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            {openGameLabel}
          </TapScaleButton>
        </div>
      ) : null}
    </div>
  );
}
