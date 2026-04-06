import { Trash2 } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";

export function CommentDeleteButton({
  commentId,
  disabled,
  onDelete,
}: {
  commentId: string;
  disabled: boolean;
  onDelete: () => void;
}) {
  return (
    <TapScaleButton
      type="button"
      onClick={onDelete}
      haptic
      disabled={disabled}
      className="p-1.5 rounded-full hover:bg-destructive/15 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center text-muted-foreground hover:text-destructive"
      aria-label="Удалить комментарий"
    >
      <Trash2 className="w-4 h-4" />
    </TapScaleButton>
  );
}
