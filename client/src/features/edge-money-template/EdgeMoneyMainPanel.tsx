import { useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EdgeMoneyCampaignConfig } from "@/lib/edge-money-public";
import type { EdgeMoneyTaskProgressItemDto } from "@/lib/edge-money-task-progress-api";
import type { EdgeLeaderboardPayload } from "@/lib/edge-participant";
import { usePrefersReducedMotion } from "@/lib/motion";
import { EdgeMoneyLeaderboardRows } from "./EdgeMoneyLeaderboardRows";
import { countCompletedMoneyTasks } from "./edge-money-task-completion";

type Props = {
  money: EdgeMoneyCampaignConfig;
  leaderboard: EdgeLeaderboardPayload;
  viewerDisplayName: string;
  taskProgressTasks: EdgeMoneyTaskProgressItemDto[] | undefined;
  taskProgressLoading: boolean;
  taskProgressError: boolean;
};

export function EdgeMoneyMainPanel({
  money,
  leaderboard,
  viewerDisplayName,
  taskProgressTasks,
  taskProgressLoading,
  taskProgressError,
}: Props) {
  const reduced = usePrefersReducedMotion();
  const headline = money.money.headline?.trim() || "iPhone 16\nPro Max 256GB";
  const top = leaderboard.entries[0]?.xp ?? 0;
  const myEntry = leaderboard.entries.find((e) => e.isMe);
  const myXp = myEntry?.xp ?? 0;
  const myRank = leaderboard.myRank;
  const chancePct = useMemo(() => {
    if (top <= 0) return myXp > 0 ? 100 : 0;
    const ratio = (myXp / top) * 100;
    return Math.min(100, Math.max(0, Math.round(ratio * 10) / 10));
  }, [top, myXp]);
  const segments = 10;
  const activeSeg = Math.max(0, Math.min(segments, Math.ceil((chancePct / 100) * segments)));
  const chanceLabel = Number.isInteger(chancePct) ? chancePct.toFixed(0) : chancePct.toFixed(1);
  const { completed: tasksDone, total: tasksTotal } = useMemo(
    () => countCompletedMoneyTasks(money.money.scoringRules, taskProgressTasks),
    [money.money.scoringRules, taskProgressTasks],
  );
  const topEntries = leaderboard.entries.slice(0, 5);
  const drawDateLabel = money.scheduleEndsAt
    ? new Date(money.scheduleEndsAt).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
      })
    : "Скоро";
  const drawTimeLabel = money.scheduleEndsAt
    ? new Date(money.scheduleEndsAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "По анонсу";
  const organizerLabel = money.title.trim() || viewerDisplayName;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: reduced ? 0 : 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 14 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduced ? { duration: 0.15 } : { type: "spring" as const, stiffness: 320, damping: 26 },
    },
  };

  return (
    <div className="emoney-hide-scrollbar relative h-full w-full overflow-y-auto px-3 pt-4 pb-6 sm:px-4">
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 mx-auto w-full max-w-[430px] space-y-5">
        <motion.div variants={item} className="emoney-glass-panel relative rounded-[2rem] border border-white/10 bg-[#0f131b]/90 px-5 pb-4 pt-3">
          <div className="absolute right-4 top-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-2">
            <span className="h-4 w-4 rounded-full border border-white/60 bg-[#facc15]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#6d4df0]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#b45309]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#0891b2]" />
            <span className="h-3.5 w-3.5 rounded-full bg-[#65a30d]" />
          </div>
          <div className="pt-12 text-center">
            <h1 className="emoney-gradient-text text-[2.55rem] font-black uppercase tracking-[0.03em] sm:text-5xl">
              {money.title.trim() || "ЭРКАН"}
            </h1>
          </div>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel rounded-[2rem] border border-white/10 bg-[#0f131b]/95 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[1.55rem] font-black text-white">Рейтинг участников</h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white/80">
              {leaderboard.totalParticipants} чел.
            </span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-2">
            <EdgeMoneyLeaderboardRows
              entries={topEntries}
              myRank={myRank}
              myXp={myEntry ? myXp : null}
              myDisplayName={viewerDisplayName}
              maxRows={5}
            />
          </div>
        </motion.div>

        <motion.div
          variants={item}
          className="emoney-glass-panel rounded-[2rem] border border-white/10 bg-[#0c111b]/92 p-5"
        >
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              border: "1px solid color-mix(in srgb, var(--emoney-accent) 80%, #2b2b2b)",
              background: "color-mix(in srgb, var(--emoney-accent) 16%, transparent)",
            }}
          >
            <span className="text-base" aria-hidden>
              🏆
            </span>
            <span className="text-sm font-bold uppercase tracking-wide emoney-badge-text">Главный приз</span>
          </div>
          {money.money.mediaUrl ? (
            <motion.div
              className="mx-auto mb-5 aspect-square w-44 max-w-full overflow-hidden rounded-none sm:w-48"
              animate={reduced ? undefined : { y: [-3, 3, -3] }}
              transition={reduced ? undefined : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <img src={money.money.mediaUrl} alt="" className="h-full w-full object-cover" />
            </motion.div>
          ) : (
            <div className="mx-auto mb-5 flex h-40 w-40 items-center justify-center rounded-none border border-white/10 bg-[#081433] text-5xl emoney-float sm:h-44 sm:w-44">
              <span aria-hidden>💎</span>
            </div>
          )}
          <h2 className="text-center text-[2.62rem] font-black uppercase leading-[0.92] text-white">
            {headline.split("\n")[0] ?? "iPhone 16"}
          </h2>
          <h3 className="text-center text-[2.62rem] font-black uppercase leading-[0.92] emoney-gradient-text">
            {headline.split("\n")[1] ?? "Pro Max 256GB"}
          </h3>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f131b]/95 p-5">
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[1.35rem] font-black uppercase tracking-wide text-white/65">Ваши шансы</h3>
              <p className="mt-1 text-[0.72rem] font-medium leading-snug text-white/40">
                Доля ваших баллов от баллов лидера рейтинга (не вероятность приза).
              </p>
            </div>
            <span className="shrink-0 text-5xl font-black text-white">{chanceLabel}%</span>
          </div>
          <div className="flex h-3 w-full gap-1 rounded-full bg-white/5 p-0.5">
            {[...Array(segments)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-full flex-1 rounded-full transition-colors duration-500",
                  i < activeSeg ? "emoney-accent-bg" : "bg-white/10",
                )}
              />
            ))}
          </div>
          <p className="mt-3 text-center text-[1.1rem] text-white/55">
            {taskProgressLoading ? (
              "Загрузка прогресса заданий…"
            ) : taskProgressError ? (
              "Не удалось загрузить прогресс заданий."
            ) : tasksTotal === 0 ? (
              <>
                Активных заданий нет — свайпите вправо <span aria-hidden>👉</span>
              </>
            ) : (
              <>
                Выполнено заданий:{" "}
                <span className="font-bold text-white">
                  {tasksDone}/{tasksTotal}
                </span>{" "}
                — свайпите вправо <span aria-hidden>👉</span>
              </>
            )}
          </p>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel rounded-[2rem] border border-white/10 bg-[#0f131b]/95 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 emoney-accent" aria-hidden />
            <h3 className="text-[1.95rem] font-black uppercase tracking-wide text-white">Итоги розыгрыша</h3>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
            <div className="grid grid-cols-2 gap-2 border-b border-white/10 pb-2 text-lg text-white/45">
              <span>Дата и время</span>
              <span className="text-right">Организатор</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-2xl font-black text-white">{drawDateLabel}</p>
                <p className="text-xl font-semibold emoney-badge-text">{drawTimeLabel}</p>
              </div>
              <p className="text-right text-xl font-semibold text-white/80">{organizerLabel}</p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
