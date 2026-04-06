import { PenSquare } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { NotificationBellButton } from "@/features/notifications/components/NotificationBellButton";

type FeedHeaderProps = {
  displayName: string;
  onOpenProfile: () => void;
  onOpenCreatePost: () => void;
};

export function FeedHeader({ displayName, onOpenProfile, onOpenCreatePost }: FeedHeaderProps) {
  return (
    <div className="uix-content-x-tight glass z-10 sticky top-0 relative py-2.5">
      <div className="grid min-h-[var(--uix-touch-min)] grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <h1 className="uix-text-title font-semibold text-foreground">Лента</h1>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="mx-auto max-w-[56vw] rounded-full px-3 py-1 text-center text-[17px] font-semibold text-foreground transition-colors hover:bg-primary/5 active:bg-primary/10"
          title={displayName}
          aria-label={`Открыть профиль: ${displayName}`}
        >
          <span className="block truncate">{displayName}</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBellButton />
          <TapScaleButton
            type="button"
            haptic
            subtle
            onClick={onOpenCreatePost}
            className="inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full bg-primary/10 p-2 text-primary hover:bg-primary/20"
            aria-label="Создать пост"
          >
            <PenSquare className="h-5 w-5" />
          </TapScaleButton>
        </div>
      </div>
    </div>
  );
}

