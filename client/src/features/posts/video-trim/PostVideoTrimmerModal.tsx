import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import type { PostVideoTrimUpload } from "@/lib/posts";
import { PostVideoTrimmerTimeline } from "./PostVideoTrimmerTimeline";
import { usePostVideoTrim } from "./use-post-video-trim";

export type PostVideoTrimmerModalProps = {
  open: boolean;
  file: File | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (trim: PostVideoTrimUpload) => void;
};

/**
 * Выбор фрагмента видео для поста (≤ POST_VIDEO_MAX_SECONDS с).
 * Логика вынесена в ./use-post-video-trim и утилиты; UI — в PostVideoTrimmerTimeline.
 */
export function PostVideoTrimmerModal({ open, file, onOpenChange, onConfirm }: PostVideoTrimmerModalProps) {
  const t = usePostVideoTrim({ open, file, onConfirm });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-full w-full h-[100dvh] max-h-[100dvh] translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-0 flex flex-col gap-0 sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:border sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
        )}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 border-b border-border/60 sm:pt-6">
          <DialogTitle className="text-base sm:text-lg pr-8">Фрагмент для поста</DialogTitle>
          <p className="text-sm text-muted-foreground text-left">
            До {POST_VIDEO_MAX_SECONDS} сек. Перетащите границы или окно на полоске.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-3 overflow-y-auto">
          <div className="relative w-full max-w-md mx-auto aspect-[9/16] max-h-[48vh] bg-black rounded-lg overflow-hidden">
            {file && t.previewUrl ? (
              <video
                ref={t.videoRef}
                src={t.previewUrl}
                className="w-full h-full object-contain"
                playsInline
                preload="metadata"
                onLoadedMetadata={t.onVideoLoaded}
                onError={t.onVideoError}
                muted={false}
              />
            ) : null}
            {t.metaError ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 text-sm text-center px-4">
                {t.metaError}
              </div>
            ) : null}
          </div>

          <TapScaleButton
            type="button"
            haptic
            onClick={t.togglePlay}
            disabled={!!t.metaError || t.durationSec <= 0}
            className="mx-auto min-h-[var(--uix-touch-min)] px-6 rounded-full border border-border bg-secondary/80 text-sm font-medium"
            aria-label={t.playing ? "Пауза" : "Воспроизвести фрагмент"}
          >
            {t.playing ? "Пауза" : "Просмотр"}
          </TapScaleButton>

          <PostVideoTrimmerTimeline
            trackRef={t.trackRef}
            metaError={t.metaError}
            durationSec={t.durationSec}
            lockedShort={t.lockedShort}
            leftPct={t.leftPct}
            widthPct={t.widthPct}
            startSec={t.startSec}
            endSec={t.endSec}
            timeFromClientX={t.timeFromClientX}
            setRange={t.setRange}
            seekToStart={t.seekToStart}
            onPointerDownHandle={t.onPointerDownHandle}
          />
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border/60 gap-2 sm:gap-2 flex-row justify-end">
          <Button type="button" variant="outline" className="min-h-[var(--uix-touch-min)]" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            className="min-h-[var(--uix-touch-min)]"
            disabled={!!t.metaError || t.durationSec <= 0}
            onClick={t.handleConfirm}
          >
            Готово
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
