import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import type { RefObject, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { MotionBottomSheetPanel, MotionBottomSheetScrollArea } from "@/components/ui/motion-bottom-sheet";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import type { CommentSortMode } from "../comment-reactions/use-optimistic-comment-likes";

const SORT_OPTIONS: { id: CommentSortMode; label: string }[] = [
  { id: "interesting", label: "Сначала интересные" },
  { id: "newest", label: "Сначала новые" },
  { id: "oldest", label: "Сначала старые" },
];

const OVERLAY_TRANSITION = { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER };
const PANEL_TRANSITION = { duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER };

export function CommentsModalFrame({
  isOpen,
  onClose,
  reducedMotion,
  panelRef,
  closeButtonRef,
  commentCount,
  sortMode,
  onSortChange,
  errorBanner,
  listArea,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  reducedMotion: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  commentCount: number;
  sortMode: CommentSortMode;
  onSortChange: (mode: CommentSortMode) => void;
  errorBanner: ReactNode;
  listArea: ReactNode;
  footer: ReactNode;
}) {
  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortMode)?.label ?? SORT_OPTIONS[0].label;
  const overlayVariants = reducedMotion
    ? { initial: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const panelMotion = reducedMotion
    ? ({ initial: { y: 0 }, exit: { opacity: 0 } } as const)
    : ({ initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } } as const);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="comments-overlay"
            className="fixed inset-0 w-full bg-black/40 z-[300] backdrop-blur-sm"
            initial={overlayVariants.initial}
            animate={"animate" in overlayVariants ? overlayVariants.animate : undefined}
            exit={overlayVariants.exit}
            transition={OVERLAY_TRANSITION}
            onClick={() => onClose?.()}
          />
          <MotionBottomSheetPanel
            ref={panelRef}
            key="comments-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="comments-modal-title"
            className="fixed bottom-0 left-0 right-0 uix-responsive-max-w z-[301] bg-background rounded-t-3xl flex flex-col shadow-2xl max-h-[86dvh] min-h-[46dvh] h-[76dvh] pt-[env(safe-area-inset-top,0px)]"
            {...panelMotion}
            transition={PANEL_TRANSITION}
            disableSwipeDismiss={reducedMotion}
            omitAnimate={reducedMotion}
            onDismiss={() => onClose?.()}
            dragHandle={
              <div className="flex w-full justify-center pt-3 pb-1 sm:hidden shrink-0">
                <div className="h-1.5 w-12 rounded-full bg-border" />
              </div>
            }
          >
            <div className="px-4 py-3 border-b border-border/50 flex justify-between items-center shrink-0">
              <h2 id="comments-modal-title" className="font-bold text-lg">
                Комментарии{" "}
                <span className="text-muted-foreground font-normal text-sm ml-1">{commentCount}</span>
              </h2>
              <TapScaleButton
                ref={closeButtonRef}
                type="button"
                onClick={() => onClose?.()}
                haptic
                className="p-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </TapScaleButton>
            </div>
            <div className="shrink-0 border-b border-border/40 px-3 py-2">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <TapScaleButton
                    type="button"
                    subtle
                    haptic
                    className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-1 rounded-md px-1 py-1.5 text-sm font-medium text-primary outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Порядок комментариев: ${sortLabel}`}
                  >
                    <span>{sortLabel}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  </TapScaleButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[320] min-w-[13rem]">
                  <DropdownMenuRadioGroup
                    value={sortMode}
                    onValueChange={(v) => onSortChange(v as CommentSortMode)}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {errorBanner}

            <MotionBottomSheetScrollArea className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain scroll-smooth p-4">
              {listArea}
            </MotionBottomSheetScrollArea>

            <div className="p-3 pt-2 border-t border-border/50 pb-[max(var(--uix-space-2),env(safe-area-inset-bottom,0px))] bg-background shrink-0">
              {footer}
            </div>
          </MotionBottomSheetPanel>
        </>
      )}
    </AnimatePresence>
  );
}
