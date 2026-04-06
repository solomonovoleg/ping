import { X } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import type { CommentItem } from "../shared/types";

export function ReplyTargetBanner({
  target,
  onClear,
}: {
  target: CommentItem;
  onClear: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-r-xl border border-border/45 border-l-4 border-l-primary/50 bg-secondary/30 py-2 pl-3 pr-1 text-[13px] text-muted-foreground">
      <div className="min-w-0">
        <p className="min-w-0 truncate">
          <span className="text-muted-foreground">Ответ ·</span>{" "}
          <span className="font-semibold text-foreground">{target.user}</span>
        </p>
        {target.text?.trim() ? (
          <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground/90">
            {target.text.trim()}
          </p>
        ) : null}
      </div>
      <TapScaleButton
        type="button"
        haptic
        subtle
        onClick={onClear}
        className="p-1.5 rounded-full hover:bg-secondary shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
        aria-label="Отменить ответ"
      >
        <X className="w-4 h-4" />
      </TapScaleButton>
    </div>
  );
}
