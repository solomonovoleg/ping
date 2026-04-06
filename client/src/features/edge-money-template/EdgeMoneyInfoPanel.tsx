import { motion } from "framer-motion";
import { Calendar, Info, ShieldAlert, Sparkles, Trophy } from "lucide-react";
import type { EdgeMoneyCampaignConfig } from "@/lib/edge-money-public";
import { usePrefersReducedMotion } from "@/lib/motion";

type Props = { money: EdgeMoneyCampaignConfig };

export function EdgeMoneyInfoPanel({ money }: Props) {
  const reduced = usePrefersReducedMotion();
  const tiers = money.money.prizeTiers ?? [];
  const headline = money.money.headline?.trim() || money.title.trim();

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: reduced ? 0 : 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: reduced ? 0 : 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduced ? { duration: 0.15 } : { type: "spring" as const, stiffness: 300, damping: 26 },
    },
  };

  return (
    <div className="emoney-hide-scrollbar h-full w-full overflow-y-auto px-6 pt-12 pb-6">
      <motion.div variants={container} initial="hidden" animate="show" className="relative z-10 space-y-5">
        <motion.div variants={item} className="mb-8 space-y-2 text-center">
          <div className="relative mb-3 inline-flex justify-center">
            <div className="absolute inset-0 rounded-full blur-xl" style={{ backgroundColor: "var(--emoney-glow)" }} aria-hidden />
            <Info className="relative z-10 h-12 w-12 emoney-accent emoney-glow" aria-hidden />
          </div>
          <h1 className="emoney-gradient-text text-3xl font-black drop-shadow-sm">О розыгрыше</h1>
          <p className="text-sm font-medium uppercase tracking-wide emoney-badge-text">Вся необходимая информация</p>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel relative overflow-hidden rounded-[1.75rem] p-5 shadow-lg">
          <div className="flex gap-4">
            <div className="relative rounded-2xl p-3.5 shadow-inner emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
              <Trophy className="h-7 w-7 emoney-accent" aria-hidden />
              <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse emoney-badge-text" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1.5 text-lg font-bold tracking-tight text-white">Главный приз и места</h3>
              {tiers.length ? (
                <ul className="space-y-2 text-sm leading-relaxed text-white/60">
                  {tiers.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
                      <span className="shrink-0 text-xs font-bold emoney-accent">
                        {t.fromRank === t.toRank ? `${t.fromRank}` : `${t.fromRank}–${t.toRank}`}
                      </span>
                      <span className="text-white/85">{t.label}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-white/55">Создатель ещё не настроил ступени призов.</p>}
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel rounded-[1.75rem] p-5">
          <div className="flex gap-4">
            <div className="rounded-2xl p-3.5 emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
              <Calendar className="h-7 w-7 emoney-accent" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-1.5 text-lg font-bold text-white">Дата итогов</h3>
              <p className="text-sm leading-relaxed text-white/60">
                {money.scheduleEndsAt ? (
                  <>
                    Победители фиксируются{" "}
                    <span className="rounded-md emoney-accent-soft-bg px-1.5 py-0.5 font-bold emoney-accent">
                      {new Date(money.scheduleEndsAt).toLocaleString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                ) : "Дата окончания не указана — уточните у организатора."}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={item} className="emoney-glass-panel rounded-[1.75rem] p-5">
          <div className="flex gap-4">
            <div className="rounded-2xl p-3.5 emoney-accent-soft-bg" style={{ border: "1px solid var(--emoney-accent)" }}>
              <ShieldAlert className="h-7 w-7 emoney-accent" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="mb-2 text-lg font-bold text-white">Правила участия</h3>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex gap-2 rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full emoney-accent-bg" aria-hidden />
                  <span>Делайте действия в Пинге — баллы идут в рейтинг (когда сервер начислит события).</span>
                </li>
                <li className="flex gap-2 rounded-lg border border-white/5 bg-white/5 p-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full emoney-accent-bg" aria-hidden />
                  <span>Чем выше место, тем лучше приз по правилам организатора: {headline}</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
        <motion.div variants={item} className="pt-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Организатор кампании</p>
          <div className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/55">
            {headline || "EDGE MONEY"}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
