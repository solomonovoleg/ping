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
import {
  getHungerLevel,
  moodDotsFilled,
  speechLine,
  xpProgressWithinLevel,
} from "@/features/edge-companion/edge-pet-display-helpers";
import type { CompanionCharacterConfig } from "@/features/edge-companion/companion-surfaces/types";
import { cn } from "@/lib/utils";

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

/** «Герою уже Nч Mм с вами» */
function formatJoinedShort(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, Date.now() - t);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0 && m <= 0) return "только что с вами";
  if (h < 48) return `${h}ч ${m}м`;
  const d = Math.floor(h / 24);
  return `${d} дн. с вами`;
}

type Props = {
  edgeId: string;
  character: CompanionCharacterConfig | null;
  templates: unknown[];
  stats: EdgeParticipantState;
  locked: boolean;
  reducedMotion: boolean;
  /** Подмена текста в «пузыре» (например призыв «Начать игру» для новичка). */
  speechBubbleOverride?: string | null;
};

/**
 * Полноэкранный «студийный» макет персонажа: без тяжёлых карточек у метрик,
 * облако — одна фраза настроения (как в референсе), тап по кругу.
 */
export function EdgeCompanionCharacterHero({
  edgeId,
  character,
  templates,
  stats,
  locked,
  reducedMotion,
  speechBubbleOverride = null,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const previewGifts = useMemo(() => templates.slice(0, 4), [templates]);
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
  const hunger = getHungerLevel(stats.lastFedAt ?? null, stats.happyScore);
  const speech = speechLine(stats.mood, hunger);
  const bubbleFromMood = speech.endsWith("…") || speech.endsWith(".") ? speech : `${speech}.`;
  const bubbleText =
    typeof speechBubbleOverride === "string" && speechBubbleOverride.trim()
      ? speechBubbleOverride.trim()
      : bubbleFromMood;
  const moodLabel = MOOD_RU[stats.mood] ?? stats.mood;
  const xp = xpProgressWithinLevel(stats.xp, stats.level);
  const dots = moodDotsFilled(stats.happyScore);
  const joinedHint = formatJoinedShort(stats.joinedAt);

  const handleTap = () => {
    if (locked) {
      toast({ title: "Кампания на паузе или завершена" });
      return;
    }
    tapMutation.mutate();
  };

  return (
    <div className="box-border w-full px-0 pb-1 pt-1">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-start md:gap-4">
        {/* Призы — без подложки */}
        <aside className="md:col-span-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Trophy className="h-3.5 w-3.5 text-primary" aria-hidden />
            Призы
          </p>
          {previewGifts.length === 0 ? (
            <p className="text-[12px] leading-snug text-muted-foreground">Настроены в кампании.</p>
          ) : (
            <ul className="space-y-2">
              {previewGifts.map((t, i) => {
                const q = giftQuantity(t);
                return (
                  <li key={i} className="text-[12px] leading-snug">
                    <span className="font-medium text-foreground">{giftTitle(t)}</span>
                    {q != null ? (
                      <span className="text-muted-foreground"> · {q} шт.</span>
                    ) : null}
                    {giftDescription(t) ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
                        {giftDescription(t)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Центр: облако + персонаж */}
        <div className="flex flex-col items-center md:col-span-6">
          <div className="relative flex w-full max-w-[280px] flex-col items-center">
            {/* Облако: классический хвост по центру вниз */}
            <div className="relative z-10 w-full max-w-[min(100%,280px)]">
              <div
                className="relative rounded-2xl border border-border/45 bg-card px-4 py-3 text-center shadow-sm"
                role="status"
              >
                <p className="text-[15px] font-medium leading-snug text-foreground">{bubbleText}</p>
              </div>
              <div
                className="absolute left-1/2 top-full z-10 -mt-px h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-border/45 bg-card"
                aria-hidden
              />
            </div>

            <TapScaleButton
              type="button"
              haptic
              subtle
              disabled={tapMutation.isPending}
              onClick={handleTap}
              className="relative mt-5 flex flex-col items-center rounded-2xl border border-transparent bg-transparent p-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Тап по ${displayName}`}
            >
              <AnimatePresence>
                {tapBurstKey > 0 ? (
                  <motion.span
                    key={tapBurstKey}
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: -28, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DURATION_FAST_S * 1.2, ease: EASING_OUT_BEZIER }}
                    className="pointer-events-none absolute left-1/2 top-[12%] z-20 -translate-x-1/2 text-sm font-semibold text-primary [text-shadow:0_1px_2px_hsl(var(--background)/0.9)]"
                  >
                    +тап
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <motion.div
                className={cn(
                  "relative flex h-[11rem] w-[11rem] items-center justify-center rounded-[42%] border border-border/40 bg-[repeating-conic-gradient(hsl(var(--muted)/0.28)_0%_25%,transparent_0%_50%)_50%_/_14px_14px] shadow-inner sm:h-[13rem] sm:w-[13rem]",
                )}
                animate={reducedMotion ? undefined : { y: [0, -6, 0] }}
                transition={
                  reducedMotion
                    ? undefined
                    : {
                        duration: DURATION_NORMAL_S * 10,
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
                  <Bird className="h-20 w-20 text-primary sm:h-24 sm:w-24 pointer-events-none" strokeWidth={1.25} />
                )}
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Gift className="h-4 w-4" aria-hidden />
                </span>
                {tapMutation.isPending ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[42%] bg-background/45">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
                  </span>
                ) : null}
              </motion.div>
            </TapScaleButton>
            <p
              className="mt-2 text-center font-semibold text-foreground"
              style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
            >
              {displayName}
            </p>
          </div>
        </div>

        {/* Метрики — на фоне страницы, без карточек */}
        <aside className="md:col-span-3">
          <p className="mb-2 text-xs font-semibold text-foreground">Твой герой</p>
          {joinedHint ? (
            <p className="mb-3 text-[11px] leading-snug text-muted-foreground">
              С вами уже <span className="font-medium text-primary">{joinedHint}</span>
            </p>
          ) : null}
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between gap-2 text-muted-foreground">
              <span>Уровень</span>
              <span className="font-semibold tabular-nums text-foreground">{stats.level}</span>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                <span>XP</span>
                <span className="tabular-nums">{xp.toNext} до след.</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${xp.pct}%` }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1" aria-label={moodLabel}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full",
                    i < dots ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              ))}
              <span className="ml-1 text-foreground">{moodLabel}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Настроение: {stats.happyScore}%</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
