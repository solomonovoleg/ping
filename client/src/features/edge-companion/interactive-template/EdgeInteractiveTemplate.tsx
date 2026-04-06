import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerTapFeedback } from "@/lib/micro-feedback";
import type { EdgeTaskPresetPublic, ResultsLivePayload } from "@/lib/edge-gamification";
import type { EdgeParticipantState } from "@/lib/edge-participant";
import type { CompanionUiPayload } from "@/features/edge-companion/companion-surfaces/types";
import { tryRegisterIntroSurfaceSwipe } from "@/features/edge-companion/edge-intro-onboarding";
import { usePrefersReducedMotion } from "@/lib/motion";
import { buildInteractiveTabs, tabLabel, type EdgeTemplateTabId } from "./build-interactive-tabs";
import { InteractiveTemplateFriendsPage } from "./InteractiveTemplateFriendsPage";
import { InteractiveTemplateGamePage } from "./InteractiveTemplateGamePage";
import { InteractiveTemplateLeaderboardPage } from "./InteractiveTemplateLeaderboardPage";
import { InteractiveTemplatePrizesPage } from "./InteractiveTemplatePrizesPage";
import { InteractiveTemplateRulesPage } from "./InteractiveTemplateRulesPage";
import { InteractiveTemplateTasksPage } from "./InteractiveTemplateTasksPage";
import { InteractiveTemplateWinMoneyPage } from "./InteractiveTemplateWinMoneyPage";
import { giftTitle } from "./gift-helpers";
import type { InteractiveTemplateNav } from "./interactive-template-nav";
import {
  EDGE_REWARD_READY_CHROME_DEFAULT,
  type EdgeRewardReadyChromeVariant,
} from "@/lib/edge-task-reward-ready";

const SLIDE_TOP_PAD = "max(62px, calc(48px + env(safe-area-inset-top, 0px)))";

type Props = {
  edgeId: string;
  campaignTitle: string;
  onBack: () => void;
  backAriaLabel: string;
  visible: import("@/features/edge-companion/companion-surfaces/types").CompanionSurfaceId[];
  companionUi: CompanionUiPayload;
  giftTemplates: unknown[];
  resultsLive?: ResultsLivePayload | null;
  interactLocked?: boolean;
  taskPresets?: EdgeTaskPresetPublic[];
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  introTapCount?: number;
  participantState: EdgeParticipantState | undefined;
  onParticipantState: (s: EdgeParticipantState) => void;
  pingInviteTemplate?: string | null;
  scheduleEndsAt?: string | null;
  onActiveSurfaceChange?: (index: number, id: EdgeTemplateTabId) => void;
  /** Оформление «награда готова» на экране заданий (светлый полноэкранный шаблон → `light`). */
  taskRewardReadyChrome?: EdgeRewardReadyChromeVariant;
};

export function EdgeInteractiveTemplate({
  edgeId,
  campaignTitle,
  onBack,
  backAriaLabel,
  visible,
  companionUi,
  giftTemplates,
  resultsLive,
  interactLocked = false,
  taskPresets = [],
  leaderboardPrimaryEnabled = true,
  leaderboardSecondaryEnabled = true,
  introTapCount = 0,
  participantState,
  onParticipantState,
  pingInviteTemplate,
  scheduleEndsAt,
  onActiveSurfaceChange,
  taskRewardReadyChrome = EDGE_REWARD_READY_CHROME_DEFAULT,
}: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const transitionMs = reducedMotion ? 0 : 320;
  const showFriends = Boolean(pingInviteTemplate?.trim());
  const templateVisible = useMemo(
    () => buildInteractiveTabs(visible, showFriends),
    [visible, showFriends],
  );

  const startIndex = useMemo(() => {
    const ch = templateVisible.indexOf("character");
    if (ch >= 0) return ch;
    const lb = templateVisible.indexOf("leaderboard");
    if (lb >= 0) return lb;
    const lb2 = templateVisible.indexOf("leaderboardSecondary");
    if (lb2 >= 0) return lb2;
    return 0;
  }, [templateVisible]);

  const [pageIdx, setPageIdx] = useState(() =>
    Math.min(Math.max(0, startIndex), Math.max(0, templateVisible.length - 1)),
  );
  const ptr = useRef<{ x: number; y: number; id: number } | null>(null);
  const scrolling = useRef(false);
  const mounted = useRef(false);
  const visibleRef = useRef(templateVisible);
  visibleRef.current = templateVisible;
  const prevIdx = useRef(-1);
  const introTapsRef = useRef(introTapCount);
  introTapsRef.current = introTapCount;

  const visibleKey = templateVisible.join("\0");
  useEffect(() => {
    const next = Math.min(Math.max(0, startIndex), Math.max(0, templateVisible.length - 1));
    setPageIdx(next);
  }, [startIndex, visibleKey, templateVisible.length]);

  const goTo = useCallback((idx: number) => {
    const n = visibleRef.current.length;
    if (n <= 0) return;
    setPageIdx(Math.max(0, Math.min(n - 1, idx)));
  }, []);

  const goToId = useCallback(
    (id: EdgeTemplateTabId) => {
      const i = visibleRef.current.indexOf(id);
      if (i >= 0) goTo(i);
    },
    [goTo],
  );

  const nav: InteractiveTemplateNav = useMemo(
    () => ({
      goToCharacter: () => goToId("character"),
      goToTasks: () => goToId("tasks"),
      goToLeaderboardPrimary: () => goToId("leaderboard"),
      goToWinMoney: () => goToId("results"),
      goToPrizes: () => goToId("prizes"),
    }),
    [goToId],
  );

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    const id = templateVisible[pageIdx];
    if (!id) return;
    onActiveSurfaceChange?.(pageIdx, id);
    tryRegisterIntroSurfaceSwipe(edgeId, introTapsRef.current, templateVisible, pageIdx);
    if (mounted.current && prevIdx.current >= 0 && prevIdx.current !== pageIdx) {
      triggerTapFeedback({ haptic: true, sound: false });
    }
    prevIdx.current = pageIdx;
  }, [edgeId, onActiveSurfaceChange, pageIdx, templateVisible]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ptr.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    scrolling.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptr.current || ptr.current.id !== e.pointerId) return;
    const dx = Math.abs(e.clientX - ptr.current.x);
    const dy = Math.abs(e.clientY - ptr.current.y);
    if (!scrolling.current && dy > dx + 6) scrolling.current = true;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!ptr.current || ptr.current.id !== e.pointerId) {
      ptr.current = null;
      return;
    }
    if (!scrolling.current) {
      const dx = e.clientX - ptr.current.x;
      const dy = e.clientY - ptr.current.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        goTo(pageIdx + (dx < 0 ? 1 : -1));
      }
    }
    ptr.current = null;
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    if (ptr.current?.id === e.pointerId) ptr.current = null;
  };

  const prizeLines = useMemo(
    () => giftTemplates.map((t) => giftTitle(t)).filter(Boolean),
    [giftTemplates],
  );

  const characterUrl = companionUi.character?.assetUrl?.trim() ?? "";

  const renderSlide = (id: EdgeTemplateTabId) => {
    switch (id) {
      case "prizes":
        return <InteractiveTemplatePrizesPage giftTemplates={giftTemplates} nav={nav} />;
      case "leaderboard":
        return (
          <InteractiveTemplateLeaderboardPage
            edgeId={edgeId}
            kind="primary"
            giftCount={giftTemplates.length}
            nav={nav}
            pageTitle="🏆 Рейтинг"
          />
        );
      case "leaderboardSecondary":
        return (
          <InteractiveTemplateLeaderboardPage
            edgeId={edgeId}
            kind="secondary"
            giftCount={giftTemplates.length}
            nav={nav}
            pageTitle="⚡ Активность"
          />
        );
      case "results":
        return (
          <InteractiveTemplateWinMoneyPage
            edgeId={edgeId}
            giftTemplates={giftTemplates}
            resultsLive={resultsLive ?? null}
            scheduleEndsAt={scheduleEndsAt}
            nav={nav}
          />
        );
      case "character":
        return (
          <InteractiveTemplateGamePage
            edgeId={edgeId}
            campaignTitle={campaignTitle}
            characterImageUrl={characterUrl}
            prizeLines={prizeLines}
            participantState={participantState}
            interactLocked={interactLocked}
            onParticipantState={onParticipantState}
            onRewardGoToPrizes={() => nav.goToPrizes()}
          />
        );
      case "info":
        return <InteractiveTemplateRulesPage article={companionUi.infoArticle} nav={nav} />;
      case "tasks":
        return (
          <InteractiveTemplateTasksPage
            edgeId={edgeId}
            presets={taskPresets}
            interactLocked={interactLocked}
            leaderboardPrimaryEnabled={leaderboardPrimaryEnabled}
            leaderboardSecondaryEnabled={leaderboardSecondaryEnabled}
            onParticipantState={onParticipantState}
            participantState={participantState}
            nav={nav}
            taskRewardReadyChrome={taskRewardReadyChrome}
          />
        );
      case "friends":
        return <InteractiveTemplateFriendsPage campaignTitle={campaignTitle} nav={nav} />;
      default:
        return null;
    }
  };

  if (templateVisible.length === 0) {
    return null;
  }

  return (
    <div
      className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{
        background: "#060b18",
        fontFamily: "'Inter',-apple-system,sans-serif",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
      data-edge-companion-embla-viewport
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="absolute left-0 right-0 top-0 z-[100]"
        style={{
          padding: "max(env(safe-area-inset-top, 10px), 10px) 10px 8px",
          background: "linear-gradient(180deg,rgba(6,11,24,0.97) 70%,transparent 100%)",
          backdropFilter: "blur(8px)",
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerMove={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={() => onBack()}
            aria-label={backAriaLabel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white shadow-sm transition-colors hover:bg-white/[0.1]"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden />
          </TapScaleButton>
          <div className="relative min-w-0 flex-1">
            <div
              className="flex items-center gap-px overflow-x-auto rounded-[24px] border border-white/[0.07] bg-white/[0.045] py-[3px] pl-1 pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: "touch" }}
              role="tablist"
              aria-label="Разделы кампании"
            >
              {templateVisible.map((sid, i) => (
                <button
                  key={`${sid}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={pageIdx === i}
                  onClick={() => goTo(i)}
                  className="shrink-0 cursor-pointer whitespace-nowrap rounded-[20px] border-none transition-all duration-[0.22s] ease-out"
                  style={{
                    background:
                      pageIdx === i ? "linear-gradient(135deg,#7c3aed,#6366f1)" : "transparent",
                    padding: "4px 9px",
                    color: pageIdx === i ? "#fff" : "rgba(255,255,255,0.35)",
                    fontWeight: pageIdx === i ? 700 : 500,
                    fontSize: 10.5,
                    letterSpacing: 0.1,
                    boxShadow: pageIdx === i ? "0 0 12px rgba(124,58,237,0.5)" : "none",
                  }}
                >
                  {tabLabel(sid)}
                </button>
              ))}
            </div>
            <div
              className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 rounded-r-[24px]"
              style={{
                background: "linear-gradient(90deg,transparent,rgba(6,11,24,0.85))",
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="absolute inset-0 flex min-h-0"
        style={{
          transform: `translateX(${-pageIdx * 100}%)`,
          transition: `transform ${transitionMs}ms cubic-bezier(0.4,0,0.2,1)`,
          willChange: "transform",
        }}
        role="region"
        aria-label="Экраны кампании: свайп влево и вправо"
      >
        {templateVisible.map((id) => (
          <div
            key={id}
            className="relative h-full min-h-0 w-full shrink-0 overflow-hidden"
            style={{ touchAction: "pan-y" }}
          >
            <div
              className="box-border h-full min-h-0 w-full overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[var(--uix-space-4)] [touch-action:pan-y]"
              style={{ paddingTop: SLIDE_TOP_PAD }}
            >
              {renderSlide(id)}
            </div>
          </div>
        ))}
      </div>

      {pageIdx > 0 ? (
        <button
          type="button"
          aria-label="Предыдущий раздел"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goTo(pageIdx - 1);
          }}
          className="absolute left-[5px] top-1/2 z-50 -translate-y-1/2 border-none bg-transparent p-2 opacity-20 transition-opacity duration-200 hover:opacity-[0.65] focus-visible:opacity-70 focus-visible:outline-none"
        >
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path
              d="M18 4L8 14L18 24"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
      {pageIdx < templateVisible.length - 1 ? (
        <button
          type="button"
          aria-label="Следующий раздел"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goTo(pageIdx + 1);
          }}
          className="absolute right-[5px] top-1/2 z-50 -translate-y-1/2 border-none bg-transparent p-2 opacity-20 transition-opacity duration-200 hover:opacity-[0.65] focus-visible:opacity-70 focus-visible:outline-none"
        >
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden>
            <path
              d="M10 4L20 14L10 24"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
