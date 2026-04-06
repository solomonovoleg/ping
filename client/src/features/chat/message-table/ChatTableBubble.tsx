import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Maximize2, Table2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DURATION_NORMAL_MS,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { ChatTableGrid } from "./chat-table-grid";
import { tablePayloadToDelimitedText } from "./payload";
import type { ChatTablePayloadV1 } from "./types";

type ChatTableBubbleProps = {
  payload: ChatTablePayloadV1;
  className?: string;
};

function useHorizontalScrollFade(scrollRef: React.RefObject<HTMLDivElement | null>, deps: unknown) {
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setFade(el.scrollWidth > el.clientWidth + 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [scrollRef, deps]);
  return fade;
}

function copyDelimited(text: string, onDone: () => void) {
  void navigator.clipboard.writeText(text).then(onDone).catch(() => {});
}

function ChatTableBubbleInner({ payload, className }: ChatTableBubbleProps) {
  const [open, setOpen] = useState(false);
  const [copiedBubble, setCopiedBubble] = useState(false);
  const [copiedDialog, setCopiedDialog] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const miniScrollRef = useRef<HTMLDivElement>(null);
  const rows = payload.rows;
  const colN = rows[0]?.length ?? 0;
  const rowN = rows.length;
  const delimited = tablePayloadToDelimitedText(payload);
  const showMiniFade = useHorizontalScrollFade(miniScrollRef, `${rowN}x${colN}`);

  const onOpenChange = useCallback((v: boolean) => {
    setOpen(v);
    if (v) triggerLightHaptic();
  }, []);

  const handleCopyBubble = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      copyDelimited(delimited, () => {
        setCopiedBubble(true);
        triggerLightHaptic();
        window.setTimeout(() => setCopiedBubble(false), 1600);
      });
    },
    [delimited],
  );

  const handleCopyDialog = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      copyDelimited(delimited, () => {
        setCopiedDialog(true);
        triggerLightHaptic();
        window.setTimeout(() => setCopiedDialog(false), 1600);
      });
    },
    [delimited],
  );

  if (!rowN || !colN) return null;

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 } as const,
        animate: { opacity: 1, y: 0 } as const,
        transition: { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER },
      };

  return (
    <div
      className={cn("max-w-[min(300px,86vw)]", className)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={cn(
          "overflow-hidden rounded-[14px] border border-border/55 bg-card/90 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)]",
          "dark:border-border/45 dark:bg-card/70 dark:shadow-[0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/45 bg-gradient-to-r from-primary/[0.07] via-transparent to-violet-500/[0.05] px-3 py-2.5 dark:from-primary/10">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary dark:bg-primary/20">
            <Table2 className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground">Таблица</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {colN} столб. · {rowN} строк
            </p>
          </div>
          <span
            className="shrink-0 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            aria-hidden
          >
            {colN}×{rowN}
          </span>
        </div>

        <div className="relative">
          <div
            ref={miniScrollRef}
            className={cn(
              "overflow-x-auto px-2 py-2",
              !reduceMotion && "scroll-smooth",
            )}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <ChatTableGrid rows={rows} variant="compact" emphasizeFirstRow />
          </div>
          {showMiniFade ? (
            <div
              className="pointer-events-none absolute inset-y-2 right-0 z-[1] w-10 bg-gradient-to-l from-card to-transparent dark:from-card/90"
              aria-hidden
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-border/40 bg-muted/15 px-2 py-2 dark:bg-muted/10">
          <TapScaleButton
            type="button"
            haptic
            onClick={handleCopyBubble}
            className={cn(
              "inline-flex min-h-[var(--uix-touch-min)] flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[12px] font-medium transition-colors",
              copiedBubble
                ? "bg-emerald-600/90 text-white dark:bg-emerald-600"
                : "bg-muted/60 text-foreground/90 hover:bg-muted dark:bg-muted/50",
            )}
            aria-label={copiedBubble ? "Скопировано" : "Скопировать таблицу"}
          >
            {copiedBubble ? <Check className="h-4 w-4 shrink-0" /> : <Copy className="h-4 w-4 shrink-0" />}
            {copiedBubble ? "Скопировано" : "Копировать"}
          </TapScaleButton>

          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
              <TapScaleButton
                type="button"
                haptic
                className="inline-flex min-h-[var(--uix-touch-min)] flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-primary/12 px-3 text-[12px] font-semibold text-primary hover:bg-primary/18 dark:bg-primary/18 dark:hover:bg-primary/24"
                aria-label="Развернуть таблицу"
              >
                <Maximize2 className="h-4 w-4 shrink-0 opacity-90" />
                Развернуть
              </TapScaleButton>
            </DialogTrigger>
            <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(560px,94vw)]">
              <DialogHeader className="space-y-1 border-b border-border/50 px-5 pb-4 pt-5 text-left">
                <DialogTitle className="text-lg font-semibold tracking-tight">Таблица</DialogTitle>
                <DialogDescription className="text-[13px] leading-snug text-muted-foreground">
                  {colN} столбцов, {rowN} строк. Можно скопировать и вставить в Excel или Google Таблицы.
                </DialogDescription>
              </DialogHeader>
              <motion.div {...motionProps} className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-1 sm:px-5">
                <div
                  className={cn(
                    "min-h-0 flex-1 overflow-auto rounded-xl border border-border/50 bg-muted/20 p-2 dark:bg-muted/15",
                    !reduceMotion && "scroll-smooth",
                  )}
                  style={{ maxHeight: "min(58vh, 480px)", WebkitOverflowScrolling: "touch" }}
                >
                  <ChatTableGrid rows={rows} variant="comfortable" emphasizeFirstRow />
                </div>
                <TapScaleButton
                  type="button"
                  haptic
                  onClick={handleCopyDialog}
                  className={cn(
                    "mt-3 inline-flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-semibold transition-colors",
                    copiedDialog
                      ? "bg-emerald-600 text-white"
                      : "bg-primary text-primary-foreground hover:opacity-95",
                  )}
                >
                  {copiedDialog ? (
                    <>
                      <Check className="h-4 w-4" />
                      Скопировано в буфер
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Скопировать для Excel
                    </>
                  )}
                </TapScaleButton>
              </motion.div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}

export const ChatTableBubble = memo(ChatTableBubbleInner);
