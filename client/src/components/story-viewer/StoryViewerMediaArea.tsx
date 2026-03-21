import type { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { DURATION_FAST_S, EASING_OUT_BEZIER } from "@/lib/motion";
import type { Story } from "./types";
import { PULSE_ACCENT } from "./constants";

export function StoryViewerMediaArea({
  currentStory,
  isVideoStory,
  storyVideoRef,
  storyVideoMuted,
  onStoryVideoTimeUpdate,
  onStoryVideoEnded,
  prefersReducedMotion,
  dragX,
  onMainPointerDown,
  onMainPointerMove,
  onMainPointerUp,
  onMainPointerCancel,
  soundHudVisible,
  soundHudIsMuted,
  storiesLength,
  showSwipeHint,
}: {
  currentStory: Story;
  isVideoStory: boolean;
  storyVideoRef: RefObject<HTMLVideoElement | null>;
  storyVideoMuted: boolean;
  onStoryVideoTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onStoryVideoEnded: () => void;
  prefersReducedMotion: boolean;
  dragX: number;
  onMainPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMainPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMainPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMainPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  soundHudVisible: boolean;
  soundHudIsMuted: boolean;
  storiesLength: number;
  showSwipeHint: boolean;
}) {
  return (
    <div
      className="relative min-h-0 flex-1 cursor-pointer touch-pan-x touch-pan-y bg-black"
      style={{ WebkitTouchCallout: "none" as const }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={onMainPointerDown}
      onPointerMove={onMainPointerMove}
      onPointerUp={onMainPointerUp}
      onPointerCancel={onMainPointerCancel}
    >
      <motion.div
        className="absolute inset-0 z-[2] flex items-center justify-center bg-black"
        style={{ x: dragX }}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
      >
        <AnimatePresence mode="wait">
          {isVideoStory ? (
            <motion.video
              key={currentStory.id}
              ref={storyVideoRef}
              src={currentStory.image}
              className="h-full w-full select-none object-cover [-webkit-user-drag:none] sm:object-contain"
              autoPlay
              playsInline
              preload="auto"
              muted={storyVideoMuted}
              onTimeUpdate={onStoryVideoTimeUpdate}
              onEnded={onStoryVideoEnded}
              initial={prefersReducedMotion ? false : { opacity: 0.88, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0.75, scale: 0.99 }}
              transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
            />
          ) : (
            <motion.img
              key={currentStory.id}
              src={currentStory.image}
              alt=""
              className="h-full w-full select-none object-cover [-webkit-user-drag:none] sm:object-contain"
              draggable={false}
              decoding="async"
              initial={prefersReducedMotion ? false : { opacity: 0.88, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0.75, scale: 0.99 }}
              transition={{ duration: DURATION_FAST_S, ease: EASING_OUT_BEZIER }}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-[min(200px,30dvh)] bg-gradient-to-b from-black/72 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[min(280px,42dvh)] bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 z-[3] bg-[linear-gradient(135deg,rgba(255,255,255,0.03)_0%,transparent_50%,rgba(255,255,255,0.04)_100%)]"
        aria-hidden
      />

      <AnimatePresence>
        {soundHudVisible && (
          <motion.div
            className="pointer-events-none absolute bottom-3 right-3 z-[58]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <motion.div
              initial={{ scale: 0.82, y: 4 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.86, y: 4 }}
              transition={{ duration: 0.18, ease: EASING_OUT_BEZIER }}
              className="rounded-full border p-2 backdrop-blur-md"
              style={{
                borderColor: `${PULSE_ACCENT}55`,
                background: "rgba(10,8,24,0.5)",
                boxShadow: `0 0 16px ${PULSE_ACCENT}33`,
              }}
            >
              {soundHudIsMuted ? (
                <VolumeX className="h-4 w-4 text-white/90" />
              ) : (
                <Volume2 className="h-4 w-4 text-white/90" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {storiesLength > 1 && showSwipeHint && !prefersReducedMotion && (
        <>
          <motion.div
            className="pointer-events-none absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 0.55, x: 0 }}
            transition={{ duration: 0.45, ease: EASING_OUT_BEZIER }}
          >
            <ChevronLeft className="h-7 w-7 text-white" strokeWidth={2} />
          </motion.div>
          <motion.div
            className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 0.55, x: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: EASING_OUT_BEZIER }}
          >
            <ChevronRight className="h-7 w-7 text-white" strokeWidth={2} />
          </motion.div>
          <motion.p
            className="pointer-events-none absolute bottom-[28%] inset-x-0 z-10 px-4 text-center text-[11px] font-medium leading-snug text-white/85 drop-shadow-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            Удерживайте — пауза · двойной тап — звук · свайп — соседняя сториз или следующий автор в кольце
          </motion.p>
        </>
      )}
    </div>
  );
}
