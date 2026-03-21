import { ChevronLeft } from "lucide-react";
import { LoadingProgress } from "@/components/ui/loading-progress";
import { userProfileRu } from "../i18n.ru";

export function UserProfileOtherLoadingShell({ onBack }: { onBack: () => void }) {
  const s = userProfileRu.shells;
  return (
    <div className="flex flex-col h-full min-h-[200px] w-full max-w-full overflow-x-hidden bg-background">
      <div className="uix-content-x py-3 flex items-center border-b border-border/50">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 rounded-full hover:bg-secondary text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
          aria-label={s.backToFeed}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
      <LoadingProgress loading minHeight="200px" className="flex-1">
        <div className="min-h-[200px]" />
      </LoadingProgress>
    </div>
  );
}
