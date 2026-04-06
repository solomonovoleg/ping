import type { RefObject, PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/utils";
import { formatPostVideoTrimTime } from "./post-video-trim-range";

type Props = {
  trackRef: RefObject<HTMLDivElement | null>;
  metaError: string | null;
  durationSec: number;
  lockedShort: boolean;
  leftPct: number;
  widthPct: number;
  startSec: number;
  endSec: number;
  timeFromClientX: (clientX: number) => number;
  setRange: (s: number, e: number) => void;
  seekToStart: () => void;
  previewCurrentRange: () => void;
  onPointerDownHandle: (kind: "L" | "R" | "M", e: ReactPointerEvent<HTMLElement>) => void;
};

export function PostVideoTrimmerTimeline({
  trackRef,
  metaError,
  durationSec,
  lockedShort,
  leftPct,
  widthPct,
  startSec,
  endSec,
  timeFromClientX,
  setRange,
  seekToStart,
  previewCurrentRange,
  onPointerDownHandle,
}: Props) {
  const selectionLen = Math.max(0, endSec - startSec);
  const disabled = !!metaError || durationSec <= 0;

  return (
    <div className="space-y-2">
      <div
        ref={trackRef}
        className={cn(
          "relative h-14 rounded-md bg-muted overflow-hidden touch-none select-none",
          disabled ? "opacity-40 pointer-events-none" : "",
        )}
        onPointerDown={(e) => {
          if (lockedShort || disabled) return;
          if ((e.target as HTMLElement).dataset.handle) return;
          const t = timeFromClientX(e.clientX);
          const len = endSec - startSec;
          let s = t - len / 2;
          setRange(s, s + len);
          seekToStart();
          previewCurrentRange();
        }}
      >
        <div
          className="absolute top-0 bottom-0 bg-primary/25 pointer-events-none"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        {!lockedShort && !metaError && durationSec > 0 ? (
          <>
            <button
              type="button"
              data-handle="L"
              className="absolute top-0 bottom-0 w-4 min-w-[var(--uix-touch-min)] -ml-2 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing touch-manipulation"
              style={{ left: `calc(${leftPct}% - 0px)` }}
              onPointerDown={(e) => onPointerDownHandle("L", e)}
              aria-label="Начало фрагмента"
            >
              <span className="w-1.5 h-10 rounded-full bg-primary shadow-md" />
            </button>
            <button
              type="button"
              data-handle="R"
              className="absolute top-0 bottom-0 w-4 min-w-[var(--uix-touch-min)] -mr-2 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing touch-manipulation"
              style={{ left: `calc(${leftPct}% + ${widthPct}% - 8px)` }}
              onPointerDown={(e) => onPointerDownHandle("R", e)}
              aria-label="Конец фрагмента"
            >
              <span className="w-1.5 h-10 rounded-full bg-primary shadow-md" />
            </button>
            <button
              type="button"
              data-handle="M"
              className="absolute top-1 bottom-1 z-[5] cursor-grab active:cursor-grabbing touch-manipulation rounded-sm bg-transparent"
              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              onPointerDown={(e) => onPointerDownHandle("M", e)}
              aria-label="Переместить выбранный фрагмент"
            />
          </>
        ) : null}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>
          {formatPostVideoTrimTime(startSec)} — {formatPostVideoTrimTime(endSec)}
        </span>
        <span>{formatPostVideoTrimTime(selectionLen)}</span>
      </div>
    </div>
  );
}
