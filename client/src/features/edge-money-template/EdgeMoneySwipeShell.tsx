import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, usePrefersReducedMotion } from "@/lib/motion";
import type { EdgeMoneyCampaignConfig } from "@/lib/edge-money-public";
import type { EdgeMoneyTaskProgressItemDto } from "@/lib/edge-money-task-progress-api";
import type { EdgeLeaderboardPayload } from "@/lib/edge-participant";
import { EdgeMoneyInfoPanel } from "./EdgeMoneyInfoPanel";
import { EdgeMoneyMainPanel } from "./EdgeMoneyMainPanel";
import { EdgeMoneyTasksPanel } from "./EdgeMoneyTasksPanel";
import { emoneyPresetToStyle } from "./emoney-color-presets";
import "./edge-money-template.css";

const NAV = ["Инфо", "Главная", "Задания"] as const;

type Props = {
  money: EdgeMoneyCampaignConfig;
  leaderboard: EdgeLeaderboardPayload;
  viewerDisplayName: string;
  moneyTrackingStarted: boolean;
  moneyTrackingLoading: boolean;
  moneyTrackingStatusError: boolean;
  onRetryMoneyTrackingStatus: () => void;
  onStartMoneyTracking: () => Promise<void>;
  startMoneyTrackingBusy: boolean;
  taskProgressTasks: EdgeMoneyTaskProgressItemDto[] | undefined;
  taskProgressLoading: boolean;
  taskProgressError: boolean;
  onRetryTaskProgress: () => void;
};

export function EdgeMoneySwipeShell({
  money,
  leaderboard,
  viewerDisplayName,
  moneyTrackingStarted,
  moneyTrackingLoading,
  moneyTrackingStatusError,
  onRetryMoneyTrackingStatus,
  onStartMoneyTracking,
  startMoneyTrackingBusy,
  taskProgressTasks,
  taskProgressLoading,
  taskProgressError,
  onRetryTaskProgress,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const [[page, direction], setPage] = useState<[number, number]>([1, 0]);
  const touchStartX = useRef<number | null>(null);

  const paginate = useCallback((delta: number) => {
    setPage(([p]) => {
      const n = p + delta;
      if (n < 0 || n >= NAV.length) return [p, 0];
      return [n, delta];
    });
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX;
    if (end == null) return;
    const dx = end - start;
    if (dx < -56) paginate(1);
    else if (dx > 56) paginate(-1);
  };

  const variants = {
    enter: (dir: number) => ({
      x: reduced ? 0 : dir > 0 ? "100%" : "-100%",
      opacity: reduced ? 1 : 0.45,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: reduced
        ? { duration: 0.12 }
        : {
            x: { type: "spring" as const, stiffness: 300, damping: 32 },
            opacity: { duration: DURATION_NORMAL_S },
          },
    },
    exit: (dir: number) => ({
      x: reduced ? 0 : dir < 0 ? "100%" : "-100%",
      opacity: reduced ? 1 : 0.35,
      transition: reduced
        ? { duration: 0.1 }
        : {
            x: { type: "spring" as const, stiffness: 300, damping: 32 },
            opacity: { duration: 0.18 },
          },
    }),
  };

  const screens = [
    <EdgeMoneyInfoPanel key="info" money={money} />,
    <EdgeMoneyMainPanel
      key="main"
      money={money}
      leaderboard={leaderboard}
      viewerDisplayName={viewerDisplayName}
      taskProgressTasks={taskProgressTasks}
      taskProgressLoading={taskProgressLoading}
      taskProgressError={taskProgressError}
    />,
    <EdgeMoneyTasksPanel
      key="tasks"
      edgeId={money.edgeId}
      interactLocked={money.interactLocked}
      rules={money.money.scoringRules}
      moneyTrackingStarted={moneyTrackingStarted}
      moneyTrackingLoading={moneyTrackingLoading}
      moneyTrackingStatusError={moneyTrackingStatusError}
      onRetryMoneyTrackingStatus={onRetryMoneyTrackingStatus}
      onStartMoneyTracking={onStartMoneyTracking}
      startMoneyTrackingBusy={startMoneyTrackingBusy}
      taskProgressTasks={taskProgressTasks}
      taskProgressLoading={taskProgressLoading}
      taskProgressError={taskProgressError}
      onRetryTaskProgress={onRetryTaskProgress}
    />,
  ];

  const schemeStyle = useMemo(() => emoneyPresetToStyle(money.money.colorScheme), [money.money.colorScheme]);

  return (
    <div
      data-edge-money-template
      className="relative flex min-h-[min(560px,72dvh)] flex-1 flex-col overflow-hidden rounded-[32px] bg-[#030305] text-foreground"
      style={schemeStyle}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--emoney-accent) 24%, transparent) 0%, #030305 62%)",
          }}
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 h-full w-full overflow-hidden"
            >
              {screens[page]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className={cn(
            "relative z-30 shrink-0 border-t border-white/10 bg-[#050508]/92 backdrop-blur-md",
            "pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-2",
          )}
          style={{
            paddingLeft: "max(var(--uix-space-2), env(safe-area-inset-left, 0px))",
            paddingRight: "max(var(--uix-space-2), env(safe-area-inset-right, 0px))",
          }}
        >
          <div className="mx-auto flex max-w-md items-center justify-center gap-8 px-2">
            {NAV.map((label, idx) => (
              <button
                key={label}
                type="button"
                className="flex min-h-[var(--uix-touch-min)] items-center justify-center px-1"
                onClick={() => setPage([idx, idx > page ? 1 : -1])}
                aria-label={label}
                aria-current={page === idx ? "page" : undefined}
              >
                <span
                  className={cn(
                    "relative pb-1 text-[16px] font-semibold tracking-wide transition-colors duration-300",
                    page === idx ? "text-white" : "text-white/45",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full transition-all duration-300",
                      page === idx ? "w-8 emoney-accent-bg" : "w-0 bg-transparent",
                    )}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
