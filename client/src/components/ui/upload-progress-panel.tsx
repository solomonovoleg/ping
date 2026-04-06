/**
 * Единый UIX загрузки файлов: полоса, проценты, индетерминант (как в чате / сториз).
 */
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";

export type UploadProgressTone = "default" | "inverse";

export function UploadProgressTrack({
  percent,
  tone = "default",
  reducedMotion: reducedProp,
  className,
}: {
  percent: number | null;
  tone?: UploadProgressTone;
  reducedMotion?: boolean;
  className?: string;
}) {
  const reducedFromHook = usePrefersReducedMotion();
  const reducedMotion = reducedProp ?? reducedFromHook;
  const hasNumeric = percent != null;
  const clamped = hasNumeric ? Math.min(100, Math.max(0, percent!)) : 0;

  if (hasNumeric) {
    return (
      <Progress
        value={clamped}
        className={cn(
          "h-1.5 w-full",
          tone === "inverse" ? "bg-white/20 [&>div]:bg-white" : "bg-primary/15",
          className,
        )}
      />
    );
  }

  const trackBg = tone === "inverse" ? "bg-white/12" : "bg-primary/12";
  const knobBg = tone === "inverse" ? "bg-white/65" : "bg-primary/55";

  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full", trackBg, className)} aria-hidden>
      <motion.div
        className={cn("absolute top-0 bottom-0 w-[36%] min-w-[2.5rem] rounded-full", knobBg)}
        animate={reducedMotion ? { left: "32%" } : { left: ["-36%", "100%"] }}
        transition={reducedMotion ? { duration: 0 } : { duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

export type UploadProgressPanelProps = {
  title: string;
  percent: number | null;
  indeterminateHint?: string;
  tone?: UploadProgressTone;
  showIcon?: boolean;
  reducedMotion?: boolean;
  className?: string;
  /** Подпись под полосой */
  footnote?: string | null;
  /** sm — композер чата; md — модальные оверлеи */
  size?: "sm" | "md";
};

export function UploadProgressPanel({
  title,
  percent,
  indeterminateHint = "Подготовка…",
  tone = "default",
  showIcon = true,
  reducedMotion: reducedProp,
  className,
  footnote,
  size = "md",
}: UploadProgressPanelProps) {
  const reducedFromHook = usePrefersReducedMotion();
  const reducedMotion = reducedProp ?? reducedFromHook;
  const hasNumeric = percent != null;
  const clamped = hasNumeric ? Math.min(100, Math.max(0, percent!)) : 0;

  const titleCls =
    size === "sm"
      ? "truncate text-[13px] font-medium leading-tight"
      : "truncate text-base font-semibold leading-tight";
  const pctCls =
    size === "sm"
      ? "text-[12px] font-semibold tabular-nums"
      : "text-sm font-semibold tabular-nums";

  const fg = tone === "inverse" ? "text-white" : "text-foreground";
  const muted = tone === "inverse" ? "text-white/85" : "text-muted-foreground";
  const footCls = tone === "inverse" ? "text-center text-xs text-white/75" : "text-center text-xs text-muted-foreground";

  const iconWrap =
    size === "sm"
      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      : "flex h-11 w-11 shrink-0 items-center justify-center rounded-full";
  const iconTone =
    tone === "inverse" ? "bg-white/15 text-white" : "bg-primary/12 text-primary";
  const iconSz = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn("min-w-0", className)}>
      <div className={cn("flex items-center gap-2", size === "sm" ? "px-3 pt-2.5 pb-1.5" : "pb-4")}>
        {showIcon ? (
          <span className={cn(iconWrap, iconTone)} aria-hidden>
            <Upload className={iconSz} strokeWidth={2.25} />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn(titleCls, fg)}>{title}</span>
            {hasNumeric ? (
              <span
                className={cn(pctCls, muted)}
                aria-valuenow={Math.round(clamped)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {Math.round(clamped)}%
              </span>
            ) : (
              <span className={cn("shrink-0 tabular-nums", size === "sm" ? "text-[11px]" : "text-xs", muted)}>
                {indeterminateHint}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className={cn(size === "sm" ? "px-3 pb-2.5 pt-0" : "")}>
        <UploadProgressTrack percent={percent} tone={tone} reducedMotion={reducedMotion} />
      </div>
      {footnote ? <p className={cn(footCls, "mt-3 px-0.5 leading-snug")}>{footnote}</p> : null}
    </div>
  );
}

export type UploadProgressBlockingOverlayProps = {
  open: boolean;
  title: string;
  percent: number | null;
  indeterminateHint?: string;
  footnote?: string | null;
  reducedMotion?: boolean;
  zIndexClass?: string;
  ariaLabel?: string;
};

export function UploadProgressBlockingOverlay({
  open,
  title,
  percent,
  indeterminateHint,
  footnote,
  reducedMotion: rmProp,
  zIndexClass = "z-[460]",
  ariaLabel,
}: UploadProgressBlockingOverlayProps) {
  const reducedMotion = rmProp ?? usePrefersReducedMotion();
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/85 px-6 backdrop-blur-sm",
        zIndexClass,
      )}
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={ariaLabel ?? title}
    >
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: DURATION_NORMAL_S * 0.85, ease: EASING_OUT_BEZIER }}
        className="w-full max-w-sm rounded-2xl border border-border/60 bg-card px-6 py-7 shadow-lg"
      >
        <UploadProgressPanel
          title={title}
          percent={percent}
          indeterminateHint={indeterminateHint}
          footnote={footnote}
          reducedMotion={reducedMotion}
          size="md"
          className="px-0"
        />
      </motion.div>
    </div>
  );
}

/** Контент поверх превью ячейки (пост / pulse): тёмный фон задаёт родитель */
export function UploadProgressMediaTileOverlay({
  percent,
  reducedMotion: rmProp,
  className,
}: {
  percent: number | null;
  reducedMotion?: boolean;
  className?: string;
}) {
  const reducedMotion = rmProp ?? usePrefersReducedMotion();
  const hasNumeric = percent != null;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <div
        className={cn(
          "h-10 w-10 shrink-0 rounded-full border-2 border-white/90 border-t-transparent",
          !reducedMotion && "animate-spin",
        )}
        aria-hidden
      />
      <div className="flex w-full max-w-[140px] flex-col items-center gap-1.5 px-1">
        <UploadProgressTrack percent={percent} tone="inverse" reducedMotion={reducedMotion} className="w-full" />
        {hasNumeric ? (
          <span className="text-[11px] font-semibold tabular-nums text-white">{Math.round(percent!)}%</span>
        ) : (
          <span className="text-[11px] font-medium text-white/90">Подготовка…</span>
        )}
      </div>
    </div>
  );
}
