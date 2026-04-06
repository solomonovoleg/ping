import { TapScaleButton } from "@/components/ui/tap-scale";

interface DesktopMainPlaceholderProps {
  onOpenFeed: () => void;
  onOpenBoard: () => void;
}

export function DesktopMainPlaceholder({ onOpenFeed, onOpenBoard }: DesktopMainPlaceholderProps) {
  return (
    <div className="flex h-full min-h-[320px] flex-1 items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold tracking-tight">Выберите диалог</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Список чатов открыт справа. Лента, борд и настройки открываются в основной области.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <TapScaleButton
            type="button"
            subtle
            onClick={onOpenFeed}
            className="min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm hover:bg-secondary/60"
          >
            Открыть ленту
          </TapScaleButton>
          <TapScaleButton
            type="button"
            subtle
            onClick={onOpenBoard}
            className="min-h-[var(--uix-touch-min)] rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm hover:bg-secondary/60"
          >
            Открыть борд
          </TapScaleButton>
        </div>
      </div>
    </div>
  );
}
