import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { isNative } from "@/lib/capacitor-native";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DURATION_FAST_MS,
  DURATION_NORMAL_S,
  EASING_OUT,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

/** Сдвиг панели только transform + opacity (без height), см. docs/UIX_SPECIALIST_GUIDE.md */
const PANEL_Y_PX = 8;

const STEPS_WEB: { label: string; text: string }[] = [
  {
    label: "Шаг 1",
    text: "PING — персональный мессенджер: зарегистрироваться можно только по приглашению друзей. У вас есть три приглашения (коды) — они в настройках. Если понадобятся ещё — подайте заявку в настройках.",
  },
  {
    label: "Шаг 2",
    text: "В Ping нет рекламы, спама и плохих новостей. Зато есть личные чаты, видеозвонки — и надеемся на хороший контент.",
  },
  {
    label: "Шаг 3",
    text: "Полноценное приложение доступно в App Store и Google Play. В браузере можно добавить ярлык: «Поделиться» → «На экран Домой» (если поддерживает ваш браузер).",
  },
  {
    label: "Шаг 4",
    text: "Уведомления о сообщениях зависят от браузера и ОС: при появлении запроса разрешите уведомления для сайта или откройте приложение из магазина.",
  },
  {
    label: "Шаг 5",
    text: "Спасибо, что зарегистрировались. Надеемся, вам будет комфортно общаться со своими близкими.",
  },
];

const STEPS_NATIVE: { label: string; text: string }[] = [
  {
    label: "Шаг 1",
    text: "PING — персональный мессенджер: зарегистрироваться можно только по приглашению друзей. У вас есть три приглашения (коды) — они в настройках. Если понадобятся ещё — подайте заявку в настройках.",
  },
  {
    label: "Шаг 2",
    text: "В Ping нет рекламы, спама и плохих новостей. Зато есть личные чаты, видеозвонки — и надеемся на хороший контент.",
  },
  {
    label: "Шаг 3",
    text: "В приложении доступны чаты, звонки и лента. Уведомления о сообщениях можно включить в системных настройках и в разделе «Настройки» внутри PING.",
  },
  {
    label: "Шаг 4",
    text: "Спасибо, что зарегистрировались. Надеемся, вам будет комфортно общаться со своими близкими.",
  },
];

function isFirst24Hours(iso: string | null | undefined): boolean {
  if (!iso || typeof iso !== "string") return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < TWENTY_FOUR_H_MS;
}

type Props = {
  userCreatedAt?: string | null;
  feedScrollRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
};

export function NewUserFeedOnboardingStrip({ userCreatedAt, feedScrollRef, className }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState(0);

  const steps = useMemo(() => (isNative() ? STEPS_NATIVE : STEPS_WEB), []);

  const show = isFirst24Hours(userCreatedAt);
  const last = steps.length - 1;

  const closePanel = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (!expanded) return;
    const el = feedScrollRef.current;
    if (!el) return;
    const onScroll = () => closePanel();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [expanded, feedScrollRef, closePanel]);

  const toggleHeader = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  if (!show) return null;

  const panelTransition = { duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER };

  return (
    <div className={cn("mb-2", className)}>
      <div className="overflow-hidden rounded-2xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/[0.09] via-fuchsia-500/[0.05] to-violet-500/[0.08] shadow-sm shadow-indigo-950/5 dark:shadow-black/20">
        <TapScaleButton
          type="button"
          haptic
          subtle
          onClick={toggleHeader}
          className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left sm:px-3.5"
          aria-expanded={expanded}
          aria-controls={panelId}
          id={`${panelId}-trigger`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-indigo-950 dark:text-indigo-100">
            Как пользоваться?
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-indigo-600/80 transition-transform motion-reduce:transition-none dark:text-indigo-300/90",
              expanded && "rotate-180",
            )}
            style={{ transitionDuration: `${DURATION_FAST_MS}ms`, transitionTimingFunction: EASING_OUT }}
            aria-hidden
          />
        </TapScaleButton>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="panel"
              id={panelId}
              role="region"
              aria-labelledby={`${panelId}-trigger`}
              initial={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -PANEL_Y_PX }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                reducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -PANEL_Y_PX * 0.5 }
              }
              transition={panelTransition}
              className="border-t border-indigo-500/10 will-change-transform"
            >
              <div className="px-3 pb-3 pt-1 sm:px-3.5">
                <p className="text-[13px] font-semibold text-indigo-900/90 dark:text-indigo-100/95">{steps[step]!.label}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-foreground/88">{steps[step]!.text}</p>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <TapScaleButton
                    type="button"
                    haptic
                    subtle
                    disabled={step <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep((s) => Math.max(0, s - 1));
                    }}
                    className="inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-indigo-500/20 bg-background/60 text-indigo-800 disabled:opacity-35 dark:text-indigo-200"
                    aria-label="Предыдущий шаг"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </TapScaleButton>

                  <div
                    className="flex flex-1 flex-wrap items-center justify-center gap-0.5 px-0.5 sm:gap-1"
                    role="group"
                    aria-label="Переключение шагов подсказки"
                  >
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStep(i);
                        }}
                        className={cn(
                          "flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full active:scale-95",
                          "transition-transform duration-75 motion-reduce:transition-none",
                        )}
                        style={{ transitionTimingFunction: EASING_OUT }}
                        aria-label={`Шаг ${i + 1} из ${steps.length}`}
                        aria-current={i === step ? "step" : undefined}
                      >
                        <span
                          className={cn(
                            "block rounded-full transition-all motion-reduce:transition-none",
                            i === step
                              ? "h-2 w-6 bg-indigo-500 dark:bg-indigo-400"
                              : "h-2 w-2 bg-indigo-400/40 dark:bg-indigo-300/35",
                          )}
                          style={{ transitionDuration: `${DURATION_FAST_MS}ms`, transitionTimingFunction: EASING_OUT }}
                          aria-hidden
                        />
                      </button>
                    ))}
                  </div>

                  <TapScaleButton
                    type="button"
                    haptic
                    subtle
                    disabled={step >= last}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStep((s) => Math.min(last, s + 1));
                    }}
                    className="inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-indigo-500/20 bg-background/60 text-indigo-800 disabled:opacity-35 dark:text-indigo-200"
                    aria-label="Следующий шаг"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </TapScaleButton>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
