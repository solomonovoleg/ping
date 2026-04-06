import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";

type Props = {
  message: string;
  onRetry: () => void;
  className?: string;
};

/** Единый блок «не загрузилось» + «Повторить» для голоса и видеокружка в чате. */
export function MediaLoadError({ message, onRetry, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-[40px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-center text-[12px] text-muted-foreground",
        className,
      )}
      role="alert"
    >
      <span className="leading-snug">{message}</span>
      <TapScaleButton
        type="button"
        className="min-h-[var(--uix-touch-min)] text-[12px] font-medium text-primary underline underline-offset-2"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
      >
        Повторить
      </TapScaleButton>
    </div>
  );
}
