import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Bird, Gift, Loader2, Trophy } from "lucide-react";
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
import { EDGE_INSET } from "@/features/edge-companion/edge-uix";
import {
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

/** Полноэкранный companion: крупнее персонаж, другой текст для новичка (нет кнопки «внизу поста»). */
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

type Props = {
  edgeId: string;
  character: CompanionCharacterConfig | null;
  templates: unknown[];
  stats: EdgeParticipantState | undefined;
  isGuest: boolean;
  stateLoading: boolean;
  stateError: boolean;
  locked: boolean;
  reducedMotion: boolean;
  /** `feed` — карточка в ленте; `companion` — полный экран `/edge/companion`. */
  variant?: "feed" | "companion";
};

export function EdgeFeedCharacterSlide({
  edgeId,
  character,
  templates,
  stats,
  isGuest,
  stateLoading,
  stateError,
  locked,
  reducedMotion,
  variant = "feed",
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const previewGifts = useMemo(() => templates.slice(0, 3), [templates]);
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

  const moodLabel = stats ? MOOD_RU[stats.mood] ?? stats.mood : null;
  const hunger = stats ? getHungerLevel(stats.lastFedAt ?? null, stats.happyScore) : "ok";
  const speech = stats ? speechLine(stats.mood, hunger) : "";

  const displayLevel = isNewPlayer ? 0 : stats?.level ?? 0;
  const displayXp = isNewPlayer ? 0 : stats?.xp ?? 0;
  const xpProgress =
    stats && !isNewPlayer ? xpProgressWithinLevel(stats.xp, stats.level) : { pct: 0, toNext: 100 };
  const displayHappy = isNewPlayer ? 0 : stats?.happyScore ?? 0;
  const displayDots = isNewPlayer ? 0 : stats ? moodDotsFilled(stats.happyScore) : 0;
  const displayMoodLabel = isNewPlayer ? "—" : moodLabel ?? "—";

  const handleCharacterTap = () => {
    if (locked) {
      toast({ title: "Кампания на паузе или завершена" });
      return;
    }
    if (isGuest) {
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
    ? "Войди — увидишь свой прогресс и сможешь тапать."
    : isNewPlayer
      ? newPlayerLine
      : speech
        ? `«${speech}»`
        : null;

  const isCompanion = variant === "companion";

  return (
    <div
      className={cn(
        "box-border px-0.5",
        isCompanion ? "min-h-[280px] md:min-h-[300px]" : "min-h-[260px]",
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-2 md:items-stretch">
        <aside className="order-2 md:order-1 md:col-span-3">
          <div className={`${EDGE_INSET} h-full`}>
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
                    <li key={i} className="rounded-lg border border-border/40 bg-background/60 px-2 py-1.5">
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
                "relative z-10 mb-1 rounded-2xl border border-border/50 bg-card/95 px-3 py-2 text-center shadow-sm backdrop-blur-sm",
                isCompanion ? "max-w-[min(100%,280px)]" : "max-w-[min(100%,220px)]",
              )}
              role="status"
            >
              <p className="text-[13px] font-semibold leading-snug text-foreground">Тапни меня</p>
              {bubbleSubline ? (
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground line-clamp-3">
                  {bubbleSubline}
                </p>
              ) : null}
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
                  variant === "feed" && !reducedMotion && "edge-feed-character-aura",
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
                {variant === "feed" && !reducedMotion ? (
                  <motion.span
                    className="pointer-events-none absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
                    aria-hidden
                    animate={{ rotate: [0, 7, -5, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Gift className="h-4 w-4" aria-hidden />
                  </motion.span>
                ) : (
                  <span className="pointer-events-none absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <Gift className="h-4 w-4" aria-hidden />
                  </span>
                )}
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
          <div className={`${EDGE_INSET} h-full`}>
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
                      {isNewPlayer ? `${displayXp} / 100` : `${xpProgress.toNext} до след.`}
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
