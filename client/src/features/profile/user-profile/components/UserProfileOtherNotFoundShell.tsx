import { ChevronLeft, UserX } from "lucide-react";
import { ListEmptyState } from "@/components/ui/empty";
import { userProfileRu } from "../i18n.ru";

export function UserProfileOtherNotFoundShell({
  onBack,
  onRetry,
  showRetry,
}: {
  onBack: () => void;
  /** Сеть / временная ошибка загрузки — не только «аккаунт удалён». */
  onRetry?: () => void;
  showRetry?: boolean;
}) {
  const s = userProfileRu.shells;
  const canRetry = Boolean(showRetry && onRetry);
  return (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-x-hidden bg-background">
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
      <div className="flex flex-1 items-center justify-center p-4">
        <ListEmptyState
          icon={UserX}
          title={s.otherNotFoundTitle}
          description={canRetry ? `${s.otherNotFoundDesc} ${s.otherNotFoundNetworkHint}` : s.otherNotFoundDesc}
          actionLabel={s.toFeed}
          onAction={onBack}
          secondaryActionLabel={canRetry ? s.retryLoadProfile : undefined}
          onSecondaryAction={canRetry ? onRetry : undefined}
        />
      </div>
    </div>
  );
}
