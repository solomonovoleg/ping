import { X, MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import type { Story } from "./types";
import { PULSE_IG_GRAD } from "./constants";
import { StoryDecayRing } from "./StoryDecayRing";

export function StoryViewerHeader({
  stories,
  currentIndex,
  progress,
  currentStory,
  isOwnCurrentStory,
  remainingLabel,
  expiresAt,
  isVideoStory,
  storyVideoMuted,
  onToggleSound,
  onOpenActions,
  onClose,
}: {
  stories: Story[];
  currentIndex: number;
  progress: number;
  currentStory: Story;
  isOwnCurrentStory: boolean;
  remainingLabel: string | null;
  expiresAt: Date | null;
  isVideoStory: boolean;
  storyVideoMuted: boolean;
  onToggleSound: () => void;
  onOpenActions: () => void;
  onClose: () => void;
}) {
  return (
    <div className="z-[62] shrink-0 px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)]">
      <div className="mb-2 flex gap-1">
        {stories.map((s, idx) => (
          <div key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/[0.22]">
            <div
              className="h-full rounded-full bg-white/[0.92] transition-[width] duration-75 ease-linear"
              style={{
                width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? "100%" : "0%",
                boxShadow: idx === currentIndex ? "0 0 6px rgba(255,255,255,0.55)" : undefined,
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-start justify-between gap-2 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="relative h-9 w-9 shrink-0">
            <div className="absolute inset-[-2px] rounded-[10px]" style={{ background: PULSE_IG_GRAD }} />
            <div className="absolute inset-[-0.5px] rounded-[9px] bg-black/35" />
            <UserAvatar
              avatarUrl={currentStory.userAvatar?.trim() ? currentStory.userAvatar : undefined}
              displayName={currentStory.userName}
              seed={currentStory.authorId ?? currentStory.userName}
              size={36}
              cornerRadius={8}
              className="relative z-10 h-full w-full border border-black/25"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-bold leading-tight text-white">{currentStory.userName}</p>
            <p className="text-[10.5px] text-white/55">
              {isOwnCurrentStory ? (
                <>Мой сторис · {currentStory.time}</>
              ) : (
                <>
                  {currentStory.time}
                  {remainingLabel ? ` · исчезнет через ${remainingLabel}` : ""}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isOwnCurrentStory && expiresAt ? <StoryDecayRing expiresAt={expiresAt} /> : null}
          {isVideoStory ? (
            <button
              type="button"
              className="flex h-9 w-9 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-white/10 text-white/75 backdrop-blur-md transition-colors hover:bg-white/[0.14]"
              aria-label={storyVideoMuted ? "Включить звук" : "Выключить звук"}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSound();
              }}
            >
              {storyVideoMuted ? (
                <VolumeX className="h-[13px] w-[13px]" />
              ) : (
                <Volume2 className="h-[13px] w-[13px]" />
              )}
            </button>
          ) : null}
          <button
            type="button"
            className="flex h-9 w-9 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.14]"
            aria-label="Ещё"
            onClick={(e) => {
              e.stopPropagation();
              onOpenActions();
            }}
          >
            <MoreHorizontal className="h-[15px] w-[15px]" />
          </button>
          <button
            type="button"
            onClick={() => onClose()}
            className="flex h-9 w-9 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-md transition-colors hover:bg-white/[0.14]"
            aria-label="Закрыть"
          >
            <X className="h-[14px] w-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
