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
  edgeVitalityLabel,
  getHungerLevel,
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

function giftQuantity(t: unknown): number | null {
  if (!t || typeof t !== "object" || Array.isArray(t)) return null;
  const o = t as Record<string, unknown>;
  const q = o.quantity;
  if (typeof q === "number" && Number.isFinite(q) && q > 0) return Math.floor(q);
  return null;
}

function formatJoinedShort(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = Math.max(0, Date.now() - t);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0 && m <= 0) return "только что";
  if (h < 48) return `${h}ч ${m}м`;
  const d = Math.floor(h / 24);
  return `${d} дн.`;
}

type Props = {
  edgeId: string;
  character: CompanionCharacterConfig | null;
  templates: unknown[];
  stats: EdgeParticipantState;
  locked: boolean;
  reducedMotion: boolean;
  speechBubbleOverride?: string | null;
};

/**
 * Один «холст» без колонок-карточек: типографика и отступы на фоне страницы,
 * как в референсе — без перегородок и слоёв-card.
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
  const firstGift = templates[0];
  const extraGifts = Math.max(0, templates.length - 1);
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
  const vitality = edgeVitalityLabel(stats.mood, stats.happyScore);
  const joinedHint = formatJoinedShort(stats.joinedAt);

  const handleTap = () => {
    if (locked) {
      toast({ title: "Кампания на паузе или завершена" });
      return;
    }
    tapMutation.mutate();
  };

  const prizePrimary = useMemo(() => {
    if (!firstGift) return { line: "Призы в кампании", sub: null as string | null };
    const q = giftQuantity(firstGift);
    const title = giftTitle(firstGift);
    const line = q != null ? `${title} · ${q} шт.` : title;
    const sub = extraGifts > 0 ? `ещё ${extraGifts}` : null;
    return { line, sub };
  }, [firstGift, extraGifts]);

  return (
    <div className="box-border w-full px-0 pb-2 pt-1">
      <div
        className="relative mx-auto aspect-square w-full max-w-[min(100%,400px)]"
        aria-label="Персонаж и прогресс"
      >
        {/* Верх слева: приз — только текст, без плашек */}
        <div className="pointer-events-none absolute left-1 top-2 z-10 max-w-[46%] pl-0.5 text-left sm:left-2 sm:top-3">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            <Trophy className="h-3 w-3 text-primary/90" aria-hidden />
            Призы
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-snug text-foreground/95">
            {prizePrimary.line}
          </p>
          {prizePrimary.sub ? (
            <p className="mt-0.5 text-[10px] text-muted-foreground">{prizePrimary.sub}</p>
          ) : null}
        </div>

        {/* Справа: метрики — без рамок, только ритм строк */}
        <div className="absolute right-1 top-1/2 z-10 w-[36%] max-w-[124px] -translate-y-1/2 space-y-2 text-right text-[10px] text-muted-foreground sm:right-2 sm:text-[11px]">
          {joinedHint ? (
            <p className="leading-snug">
              С вами <span className="font-medium text-foreground/90">{joinedHint}</span>
            </p>
          ) : null}
          <div className="flex flex-col items-end gap-0.5">
            <span className="tabular-nums text-foreground">
              Ур. <span className="font-semibold">{stats.level}</span>
            </span>
            <span className="tabular-nums">{xp.toNext} XP до след.</span>
          </div>
          <div className="ml-auto h-[3px] w-10 overflow-hidden rounded-full bg-muted/50 sm:w-11">
            <div
              className="h-full rounded-full bg-primary/90 transition-[width]"
              style={{ width: `${xp.pct}%` }}
            />
          </div>
          <p
            className={cn(
              "pt-1 text-[9px] font-semibold leading-tight tracking-wide sm:text-[10px]",
              vitality.tone === "sleep" && "uppercase text-sky-400/95",
              vitality.tone === "awake" && "text-primary",
              vitality.tone === "calm" && "text-muted-foreground",
            )}
          >
            {vitality.tone === "sleep" ? "СПИТ" : vitality.label}
          </p>
          <p className="text-[9px] text-foreground/60 sm:text-[10px]">{moodLabel}</p>
        </div>

        {/* Центр */}
        <div className="absolute inset-x-0 top-9 bottom-6 flex flex-col items-center justify-center px-[8%] sm:top-10 sm:bottom-8 sm:px-[10%]">
          <div
            className="relative z-10 max-w-[min(100%,260px)] rounded-2xl bg-foreground/[0.05] px-3 py-2.5 text-center backdrop-blur-[2px]"
            role="status"
          >
            <p
              className="text-[14px] font-medium leading-snug text-foreground sm:text-[15px]"
              style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
            >
              {bubbleText}
            </p>
          </div>

          <TapScaleButton
            type="button"
            haptic
            subtle
            disabled={tapMutation.isPending}
            onClick={handleTap}
            className="relative mt-4 flex w-full max-w-[min(92vw,19rem)] flex-col items-center bg-transparent p-0 shadow-none ring-0 focus-visible:ring-2 focus-visible:ring-primary sm:max-w-[20rem]"
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
                  className="pointer-events-none absolute left-1/2 top-[6%] z-20 -translate-x-1/2 text-sm font-semibold text-primary [text-shadow:0_1px_2px_hsl(var(--background)/0.9)]"
                >
                  +тап
                </motion.span>
              ) : null}
            </AnimatePresence>
            <div className="relative flex w-full items-end justify-center">
              <motion.div
                aria-hidden
                className="pointer-events-none absolute bottom-[-6%] left-1/2 z-0 h-[min(40vw,8.5rem)] w-[min(90%,16.5rem)] -translate-x-1/2 rounded-full bg-primary/[0.24] blur-[48px] sm:h-[8.5rem] sm:w-[17rem]"
                animate={
                  reducedMotion
                    ? undefined
                    : { opacity: [0.36, 0.58, 0.36], scale: [0.97, 1.03, 0.97] }
                }
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="relative z-10 flex items-center justify-center"
                animate={reducedMotion ? undefined : { y: [0, -5, 0] }}
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
                    className="max-h-[min(70vw,16rem)] max-w-[min(88vw,16rem)] object-contain pointer-events-none sm:max-h-[17rem] sm:max-w-[17rem]"
                    draggable={false}
                  />
                ) : (
                  <Bird
                    className="h-[7.5rem] w-[7.5rem] text-primary pointer-events-none sm:h-[9rem] sm:w-[9rem]"
                    strokeWidth={1.15}
                  />
                )}
                <span className="pointer-events-none absolute -right-0.5 top-[2%] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/25">
                  <Gift className="h-[18px] w-[18px]" aria-hidden />
                </span>
                {tapMutation.isPending ? (
                  <span className="absolute inset-0 flex items-center justify-center rounded-3xl bg-background/40 backdrop-blur-[1px]">
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden />
                  </span>
                ) : null}
              </motion.div>
            </div>
          </TapScaleButton>
          <p
            className="mt-2 text-center text-sm font-semibold text-foreground sm:text-base"
            style={{ fontFamily: "var(--font-edge-pet), ui-serif, Georgia, serif" }}
          >
            {displayName}
          </p>
        </div>
      </div>
    </div>
  );
}
