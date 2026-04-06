import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bird, Gamepad2, Gift, Loader2, Sparkles, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { resolveUrl } from "@/lib/api-base";
import {
  EdgeInteractCooldownError,
  postEdgeParticipantInteract,
  type EdgeParticipantState,
} from "@/lib/edge-participant";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { DURATION_FAST_S, DURATION_NORMAL_S, EASING_OUT_BEZIER } from "@/lib/motion";
import { EDGE_ACTION_PRIMARY } from "@/features/edge-companion/edge-uix";
import {
  edgeVitalityLabel,
  getHungerLevel,
  moodDotsFilled,
  speechLine,
  xpProgressWithinLevel,
} from "@/features/edge-companion/edge-pet-display-helpers";
import type { CompanionCharacterConfig } from "@/features/edge-companion/companion-surfaces/types";
import {
  EDGE_FEED_NEW_PLAYER_SUBLINE,
  hasStartedEdgePlay,
} from "@/features/edge-companion/edge-feed-play-state";
import { cn } from "@/lib/utils";
import { EDGE_REWARD_READY_SUMMARY_READY_TW } from "@/lib/edge-task-reward-ready";
import { triggerTapFeedback } from "@/lib/micro-feedback";

/** Полноэкранный companion: крупнее персонаж, другой текст для новичка. */
const COMPANION_NEW_PLAYER_SUBLINE =
  "Тапни персонажа или действие ниже — начнём приключение!";

const MOOD_RU: Record<string, string> = {
  happy: "Весёлый",
  neutral: "Нормально",
  sad: "Грустит",
};

function giftTitle(t: unknown): string {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "Приз";
  const o = t as Record<string, unknown>;
  if (typeof o.title === "string" && o.title.trim()) return o.title.trim();
  if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  return "Приз";
}

function giftDescription(t: unknown): string | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  if (typeof o.description === "string" && o.description.trim()) return o.description.trim();
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
  return null;
}

function giftQuantity(t: unknown): number | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  const q = o.quantity;
  if (typeof q === "number" && Number.isFinite(q) && q > 0) return Math.floor(q);
  return null;
}

function prizesCountPhrase(n: number): string {
  if (n <= 0) return "Призы в кампании";
  const m = n % 10;
  const h = n % 100;
  if (h >= 11 && h <= 14) return `${n} призов`;
  if (m === 1) return `${n} приз`;
  if (m >= 2 && m <= 4) return `${n} приза`;
  return `${n} призов`;
}

type Props = {
  edgeId: string;
  /** Название кампании (лентa, левый верх квадрата). */
  campaignTitle: string;
  character: CompanionCharacterConfig | null;
  templates: unknown[];
  stats: EdgeParticipantState | undefined;
  isGuest: boolean;
  stateLoading: boolean;
  stateError: boolean;
  locked: boolean;
  reducedMotion: boolean;
  /** Открыть полный EDGE (кнопка под персонажем в ленте). */
  onOpenGame: () => void;
  openGameLabel: string;
  openGameDisabled: boolean;
  ctaAccent?: boolean;
  /** `feed` — квадрат 1:1 в посте; `companion` — запасной разъехавшийся макет. */
  variant?: "feed" | "companion";
};

export function EdgeFeedCharacterSlide({
  edgeId,
  campaignTitle,
  character,
  templates,
  stats,
  isGuest,
  stateLoading,
  stateError,
  locked,
  reducedMotion,
  onOpenGame,
  openGameLabel,
  openGameDisabled,
  ctaAccent = false,
  variant = "feed",
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const previewGifts = useMemo(() => templates.slice(0, 3), [templates]);
  const prizeCount = templates.length;
  const [tapBurstKey, setTapBurstKey] = useState(0);

  const tapMutation = useMutation({
    mutationFn: () => postEdgeParticipantInteract(edgeId, "tap"),
    onSuccess: (data) => {
      qc.setQueryData(["edge", "participant", "state", edgeId], data);
      if (!reducedMotion) setTapBurstKey((k) => k + 1);
    },
    onError: (e) => {
      if (e instanceof EdgeInteractCooldownError) {
        toast({ title: "Погоди чуть-чуть", description: e.message });
        return;
      }
      toast({
        title: e instanceof Error ? e.message : "Не удалось",
        variant: "destructive",
      });
    },
  });

  const displayName = character?.displayName?.trim() || "Персонаж";
  const imgSrc = character?.assetUrl?.trim() ? resolveUrl(character.assetUrl.trim()) : "";

  const started = Boolean(stats && hasStartedEdgePlay(stats));
  const isNewPlayer = Boolean(stats && !hasStartedEdgePlay(stats));

  const moodLabel = stats ? (MOOD_RU[stats.mood] ?? stats.mood) : null;
  const hunger = stats ? getHungerLevel(stats.lastFedAt ?? null, stats.happyScore) : "ok";
  const speech = stats ? speechLine(stats.mood, hunger) : "";

  const displayLevel = isNewPlayer ? 0 : stats?.level ?? 0;
  const displayHappy = isNewPlayer ? 0 : stats?.happyScore ?? 0;
  const xpProgress =
    stats && !isNewPlayer ? xpProgressWithinLevel(stats.xp, stats.level) : { pct: 0, toNext: 100 };
  const vitality =
    stats && !isNewPlayer
      ? edgeVitalityLabel(stats.mood, stats.happyScore)
      : ({ label: "—", tone: "calm" as const });
  const displayDots = isNewPlayer ? 0 : stats ? moodDotsFilled(stats.happyScore) : 0;
  const displayMoodLabel = isNewPlayer ? "—" : moodLabel ?? "—";

  const handleCharacterTap = () => {
    if (locked) {
      triggerTapFeedback({ haptic: true, sound: true });
      toast({ title: "Кампания на паузе или завершена" });
      return;
    }
    if (isGuest) {
      triggerTapFeedback({ haptic: true, sound: true });
      toast({
        title: "Войдите в аккаунт",
        description: "Чтобы тапать персонажа в ленте",
        variant: "destructive",
      });
      return;
    }
    tapMutation.mutate();
  };

  const newPlayerLine =
    variant === "companion" ? COMPANION_NEW_PLAYER_SUBLINE : EDGE_FEED_NEW_PLAYER_SUBLINE;
  const bubbleSubline = isGuest
    ? "Войди — прогресс и тапы."
    : isNewPlayer
      ? newPlayerLine
      : speech
        ? `«${speech}»`
        : null;

  const isCompanion = variant === "companion";
  const topPrizeLines = previewGifts.slice(0, 2);
  const topStepTotal = 3;
  const topStepCurrent = Math.min(topStepTotal, Math.max(1, Math.ceil((isNewPlayer ? 0 : xpProgress.pct) / 34)));
  const topStepProgressPct = Math.max(6, isNewPlayer ? 0 : xpProgress.pct);
  const sideTapCount = stats?.introTapCount ?? stats?.gameScriptMetrics?.dailyTapCount ?? 0;
  const sideDailyGoal = Math.max(150, sideTapCount + 1);
  const sideTapPct = Math.round((Math.max(0, Math.min(sideTapCount, sideDailyGoal)) / sideDailyGoal) * 100);
  const rightObjectiveLeft =
    stats?.actionProgress && stats.actionProgress.target > 0
      ? Math.max(0, stats.actionProgress.target - stats.actionProgress.play)
      : null;
  const transientStateLabel = isGuest
    ? "Гость"
    : stateLoading
      ? "Обновляем..."
      : stateError
        ? "Связь нестабильна"
        : null;

  /**
   * Лента: строго квадрат 1:1 (`aspect-square`) — компактное превью.
   * Полноэкранный макет игры — `InteractiveTemplateGamePage`, не дублировать сюда.
   */
  if (variant === "feed") {
    return (
      <div
        className="edge-feed-character-stage relative isolate aspect-square w-full max-w-full shrink-0 overflow-hidden rounded-2xl border border-border/45 bg-[radial-gradient(120%_96%_at_50%_65%,hsl(var(--primary)/0.28),hsl(var(--background)/0.98)_64%)]"
        data-edge-feed-character-square
      >
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(120%_60%_at_50%_110%,hsl(var(--primary)/0.24),transparent_62%)]" />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(to_bottom,hsl(var(--background)/0.18)_0%,transparent_28%,transparent_72%,hsl(var(--background)/0.36)_100%)]" />

        <div className="pointer-events-none absolute left-2.5 top-2.5 z-20 w-[40%] sm:left-3 sm:top-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/95 sm:text-[11px]">
            Интерактив
          </p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-300 sm:text-[12px]">
            <span aria-hidden>🎁</span>
            Призы:
          </p>
          {topPrizeLines.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5 text-[10px] font-semibold leading-snug text-foreground/95 sm:text-[11px]">
              {topPrizeLines.map((t, i) => (
                <li key={i} className="line-clamp-1">
                  <span className="mr-1 text-primary">•</span>
                  {giftTitle(t)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[10px] text-muted-foreground sm:text-[11px]">{prizesCountPhrase(prizeCount)}</p>
          )}
        </div>

        <div className="pointer-events-none absolute left-1/2 top-2.5 z-20 w-[35%] max-w-[152px] -translate-x-1/2 sm:top-3">
          <div className="h-[4px] overflow-hidden rounded-full bg-foreground/16">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yellow-500 via-amber-400 to-orange-400 transition-[width]"
              style={{ width: `${topStepProgressPct}%` }}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute right-2.5 top-2.5 z-20 text-right sm:right-3 sm:top-3">
          <p className="text-[10px] font-semibold text-foreground/90 sm:text-[11px]">
            {topStepCurrent}/{topStepTotal} шагов
          </p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[11px] font-semibold text-amber-300 sm:text-[12px]">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            Шаг {topStepCurrent} из {topStepTotal}
          </p>
          <div className="mt-2 flex justify-end">
            <div className="flex items-center gap-1 rounded-full bg-foreground/[0.04] px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/65" />
              <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-amber-300 to-orange-400" />
            </div>
          </div>
        </div>
        {transientStateLabel ? (
          <p className="edge-feed-state-badge pointer-events-none absolute right-3 top-[4.85rem] z-20 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-foreground/78 sm:text-[11px]">
            {transientStateLabel}
          </p>
        ) : null}

        <div className="edge-feed-hud-left absolute bottom-[5.2rem] left-2.5 z-20 w-[28%] sm:left-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/45 sm:text-[10px]">
            Тапов
          </p>
          <p className="mt-0.5 text-[52px] font-bold leading-[0.9] tracking-tight text-foreground sm:text-[56px]">
            {sideTapCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-[12px]">
            из {sideDailyGoal}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/14">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-500 to-purple-500 transition-[width]"
              style={{ width: `${sideTapPct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-[12px]">{sideTapPct}%</p>
        </div>

        <div className="edge-feed-hud-right absolute bottom-[4.85rem] right-2.5 z-20 w-[28%] text-right sm:right-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/45 sm:text-[10px]">
            Ур
          </p>
          <p className="mt-0.5 text-[46px] font-bold leading-[0.92] tracking-tight text-amber-300 sm:text-[50px]">
            {displayLevel}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground/45 sm:text-[11px]">
            XP {stats ? stats.xp : 0}
          </p>
          <div className="mt-1.5 ml-auto h-1 w-[68%] overflow-hidden rounded-full bg-foreground/14">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-400 to-fuchsia-500 transition-[width]"
              style={{ width: `${isNewPlayer ? 0 : xpProgress.pct}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-1 text-[11px] font-semibold sm:text-[12px]",
              vitality.tone === "sleep" && "uppercase text-sky-300",
              vitality.tone === "awake" && "text-amber-300",
              vitality.tone === "calm" && "text-muted-foreground",
            )}
          >
            {vitality.tone === "sleep" ? "Спит" : vitality.label}
          </p>
        </div>

        <div className="absolute inset-x-0 top-[2.95rem] bottom-[3.95rem] flex flex-col items-center justify-center px-[6%] sm:top-[3.25rem] sm:px-[8%]">
          <div
            className="edge-feed-bubble relative z-10 mb-1.5 w-fit max-w-[min(100%,220px)] shrink-0 rounded-[22px] bg-white px-3 py-1.5 text-center shadow-[0_10px_30px_hsl(var(--background)/0.45)]"
            role="status"
          >
            <span
              className="pointer-events-none absolute left-1/2 top-full h-3.5 w-3.5 -translate-x-1/2 -translate-y-[48%] rotate-45 bg-white"
              aria-hidden
            />
            <p className="max-w-[min(100%,220px)] overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-bold leading-tight text-foreground sm:text-[13px]">
              <span aria-hidden>🐣 </span>
              Тапни меня!
              {bubbleSubline ? (
                <span className="ml-1 font-normal text-[10px] text-zinc-500 sm:text-[11px]">{bubbleSubline}</span>
              ) : null}
            </p>
          </div>

          <TapScaleButton
            type="button"
            haptic
            subtle
            disabled={tapMutation.isPending}
            onClick={handleCharacterTap}
            className="relative flex flex-col items-center rounded-2xl border border-transparent bg-transparent p-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Тап по персонажу ${displayName}`}
          >
            <AnimatePresence>
              {tapBurstKey > 0 ? (
                <motion.span
                  key={tapBurstKey}
                  initial={{ opacity: 0, y: 10, scale: 0.88 }}
                  animate={{ opacity: 1, y: -28, scale: 1 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: DURATION_FAST_S * 1.25, ease: EASING_OUT_BEZIER }}
                  className="pointer-events-none absolute left-1/2 top-[6%] z-20 -translate-x-1/2 text-center text-xs font-semibold text-primary [text-shadow:0_1px_2px_hsl(var(--background)/0.95)]"
                  style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
                >
                  Ещё тап!
                </motion.span>
              ) : null}
            </AnimatePresence>

            <div className="relative flex min-h-0 w-full max-w-[min(92vw,17.5rem)] items-end justify-center sm:max-w-[18rem]">
              <motion.div
                aria-hidden
                className="pointer-events-none absolute bottom-[-6%] left-1/2 z-0 h-[min(38vw,8rem)] w-[min(88vw,15.75rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--primary)/0.5)_0%,hsl(var(--primary)/0.14)_58%,transparent_78%)] blur-[34px] sm:h-[8.35rem] sm:w-[16rem]"
                animate={
                  reducedMotion
                    ? undefined
                    : { opacity: [0.38, 0.62, 0.38], scale: [0.97, 1.03, 0.97] }
                }
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="edge-feed-character-aura relative z-10 flex items-center justify-center"
                animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
                transition={
                  reducedMotion
                    ? undefined
                    : {
                        duration: DURATION_NORMAL_S * 12,
                        repeat: Infinity,
                        ease: EASING_OUT_BEZIER,
                      }
                }
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={displayName}
                    className="max-h-[min(74vw,15.5rem)] max-w-[min(90vw,15.5rem)] object-contain pointer-events-none sm:max-h-[16.15rem] sm:max-w-[16.15rem]"
                    draggable={false}
                  />
                ) : (
                  <Bird
                    className="h-[7rem] w-[7rem] text-primary pointer-events-none sm:h-[8.5rem] sm:w-[8.5rem]"
                    strokeWidth={1.15}
                  />
                )}
                {!reducedMotion ? (
                  <motion.span
                    className="pointer-events-none absolute -right-1 top-[2%] flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-zinc-950 shadow-md sm:h-9 sm:w-9"
                    aria-hidden
                    animate={{ rotate: [0, 7, -5, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Gift className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
                  </motion.span>
                ) : (
                  <span className="pointer-events-none absolute -right-1 top-[2%] flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 text-zinc-950 shadow-md sm:h-9 sm:w-9">
                    <Gift className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden />
                  </span>
                )}
                {tapMutation.isPending ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/40 backdrop-blur-[1px]">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
                  </span>
                ) : null}
              </motion.div>
            </div>
          </TapScaleButton>
          <p
            className="mt-1.5 line-clamp-1 text-center text-[11px] font-semibold text-foreground/92 sm:text-xs"
            style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
          >
            {displayName}
          </p>
        </div>

        <div
          className={cn(
            "absolute inset-x-2.5 bottom-2.5 z-20 sm:inset-x-3 sm:bottom-3",
            ctaAccent && "edge-feed-cta-accent-wrap",
          )}
        >
          <TapScaleButton
            type="button"
            haptic
            disabled={openGameDisabled}
            onClick={onOpenGame}
            className={`${EDGE_ACTION_PRIMARY} edge-feed-cta-button w-full text-sm sm:text-base`}
            aria-label={openGameLabel}
          >
            <span className="inline-flex items-center gap-2">
              <Gamepad2 className="h-4 w-4" aria-hidden />
              {openGameLabel}
              {!openGameDisabled ? (
                <span className="rounded-full bg-white/17 px-2 py-0.5 text-[10px] font-semibold text-white/95 sm:text-[11px]">
                  +5 XP
                </span>
              ) : null}
            </span>
          </TapScaleButton>
        </div>
        {rightObjectiveLeft != null ? (
          <p className="pointer-events-none absolute bottom-[4.5rem] right-3 z-20 text-[11px] text-muted-foreground sm:text-[12px]">
            {rightObjectiveLeft} действий до шага
          </p>
        ) : null}
        {!isGuest && !locked && (stats?.taskQuestSummary?.edgeReadyToClaim ?? 0) > 0 ? (
          <div
            className="pointer-events-none absolute inset-x-2 bottom-[3.9rem] z-[28] flex justify-center sm:inset-x-3 sm:bottom-[4.05rem]"
            role="status"
            aria-label="В заданиях можно забрать награду за игру"
          >
            <span
              className={cn(
                "inline-flex max-w-[min(100%,18rem)] items-center justify-center gap-1 rounded-full bg-card/90 px-2 py-1 text-center text-[9px] font-semibold leading-tight text-primary shadow-md backdrop-blur-sm sm:text-[10px]",
                EDGE_REWARD_READY_SUMMARY_READY_TW,
              )}
            >
              <Sparkles className="h-2.5 w-2.5 shrink-0 opacity-90" aria-hidden strokeWidth={2.25} />
              <span className="line-clamp-2">Можно забрать XP — свайп к «Заданиям»</span>
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "box-border px-0.5",
        isCompanion ? "min-h-[280px] md:min-h-[300px]" : "min-h-[260px]",
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-2 md:items-stretch">
        <aside className="order-2 md:order-1 md:col-span-3">
          <div className="h-full py-1">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden />
              Призы
            </p>
            {previewGifts.length === 0 ? (
              <p className="uix-text-caption text-muted-foreground">Призы настроятся в кампании.</p>
            ) : (
              <ul className="space-y-2">
                {previewGifts.map((t, i) => {
                  const q = giftQuantity(t);
                  return (
                    <li key={i} className="py-1">
                      <p className="text-[12px] font-medium leading-tight text-foreground line-clamp-2">
                        {giftTitle(t)}
                        {q != null ? (
                          <span className="text-muted-foreground"> · {q} шт.</span>
                        ) : null}
                      </p>
                      {giftDescription(t) ? (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                          {giftDescription(t)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {templates.length > 3 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">+ ещё в игре</p>
            ) : null}
          </div>
        </aside>

        <div
          className={cn(
            "order-1 flex flex-col items-center justify-end md:order-2 md:col-span-6",
            isCompanion ? "min-h-[220px] md:min-h-[240px]" : "min-h-[200px]",
          )}
        >
          <div
            className={cn(
              "relative flex w-full flex-col items-center",
              isCompanion ? "max-w-[280px]" : "max-w-[220px]",
            )}
          >
            <div
              className={cn(
                "relative z-10 mb-1 w-fit shrink-0 rounded-2xl border border-border/50 bg-card/95 px-3 py-1.5 text-center shadow-sm backdrop-blur-sm",
                isCompanion ? "max-w-[min(100%,280px)]" : "max-w-[min(100%,220px)]",
              )}
              role="status"
            >
              <p
                className={cn(
                  "overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-semibold leading-tight text-foreground sm:text-[13px]",
                  isCompanion ? "max-w-[min(100%,280px)]" : "max-w-[min(100%,220px)]",
                )}
              >
                Тапни меня
                {bubbleSubline ? (
                  <span className="ml-1 font-normal text-[11px] text-muted-foreground">{bubbleSubline}</span>
                ) : null}
              </p>
            </div>
            <div
              className="absolute left-1/2 top-[calc(100%-4px)] z-10 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border/50 bg-card/95"
              aria-hidden
            />

            <TapScaleButton
              type="button"
              haptic
              subtle
              disabled={tapMutation.isPending}
              onClick={handleCharacterTap}
              className="relative mt-3 flex flex-col items-center rounded-2xl border border-transparent bg-transparent p-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Тап по персонажу ${displayName}`}
            >
              <AnimatePresence>
                {tapBurstKey > 0 ? (
                  <motion.span
                    key={tapBurstKey}
                    initial={{ opacity: 0, y: 10, scale: 0.88 }}
                    animate={{ opacity: 1, y: -36, scale: 1 }}
                    exit={{ opacity: 0, y: -48 }}
                    transition={{ duration: DURATION_FAST_S * 1.25, ease: EASING_OUT_BEZIER }}
                    className="pointer-events-none absolute left-1/2 top-[18%] z-20 -translate-x-1/2 text-center text-sm font-semibold text-primary [text-shadow:0_1px_2px_hsl(var(--background)/0.95)]"
                    style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
                  >
                    Ещё тап!
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <motion.div
                className={cn(
                  "relative flex items-center justify-center rounded-[42%] border border-border/50 bg-[repeating-conic-gradient(hsl(var(--muted)/0.35)_0%_25%,transparent_0%_50%)_50%_/_14px_14px] shadow-inner",
                  isCompanion
                    ? "h-[11rem] w-[11rem] sm:h-[13rem] sm:w-[13rem] md:h-[14rem] md:w-[14rem]"
                    : "h-[9.5rem] w-[9.5rem] sm:h-[11rem] sm:w-[11rem]",
                )}
                animate={reducedMotion ? undefined : { y: [0, -8, 0] }}
                transition={
                  reducedMotion
                    ? undefined
                    : {
                        duration: DURATION_NORMAL_S * 12,
                        repeat: Infinity,
                        ease: EASING_OUT_BEZIER,
                      }
                }
              >
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={displayName}
                    className="max-h-[92%] max-w-[92%] object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <Bird
                    className={cn(
                      "text-primary pointer-events-none",
                      isCompanion
                        ? "h-20 w-20 sm:h-24 sm:w-24 md:h-[6.5rem] md:w-[6.5rem]"
                        : "h-16 w-16 sm:h-20 sm:w-20",
                    )}
                    strokeWidth={1.25}
                  />
                )}
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Gift className="h-4 w-4" aria-hidden />
                </span>
                {tapMutation.isPending ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[42%] bg-background/40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                  </span>
                ) : null}
              </motion.div>
            </TapScaleButton>
            <p className="mt-2 text-center text-sm font-semibold text-foreground">{displayName}</p>
          </div>
        </div>

        <aside className="order-3 md:col-span-3">
          <div className="h-full py-1">
            <p className="mb-2 text-xs font-semibold text-foreground">Твой герой</p>
            {isGuest ? (
              <p className="uix-text-caption text-muted-foreground">
                Войди в аккаунт — покажем уровень, настроение и прогресс.
              </p>
            ) : stateLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="text-xs">Загрузка…</span>
              </div>
            ) : stateError ? (
              <p className="text-xs text-muted-foreground">Состояние временно недоступно.</p>
            ) : stats ? (
              <div className="space-y-2">
                {!started ? (
                  <p className="text-[11px] font-medium text-primary">Ещё не играл — нули до первого входа</p>
                ) : null}
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Уровень</span>
                  <span className="font-semibold text-foreground">{displayLevel}</span>
                </div>
                <div>
                  <div className="mb-0.5 flex justify-between text-[11px] text-muted-foreground">
                    <span>XP</span>
                    <span className="tabular-nums">
                      {isNewPlayer ? `0 / 100` : `${xpProgress.toNext} до след.`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${isNewPlayer ? 0 : xpProgress.pct}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 pt-1" aria-label={displayMoodLabel}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${
                        i < displayDots ? "bg-primary" : "bg-muted-foreground/25"
                      }`}
                    />
                  ))}
                  <span className="ml-1 text-[11px] text-foreground">{displayMoodLabel}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Настроение: {displayHappy}%</p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
