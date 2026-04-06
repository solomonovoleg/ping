import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { adminDialogSurfaceClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function VkParserDeleteBindingAlert(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindingTitle: string;
  vkOwnerId: string;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className={cn("max-w-md", adminDialogSurfaceClass)}>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить привязку?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Будет удалена привязка «{props.bindingTitle}» (стена <span className="font-mono">{props.vkOwnerId}</span>) и
              вся связанная с ней очередь парсера. Это действие нельзя отменить.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={props.isDeleting} className="min-h-[var(--uix-touch-min)]">
            Отмена
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            className="min-h-[var(--uix-touch-min)]"
            disabled={props.isDeleting}
            onClick={props.onConfirm}
          >
            {props.isDeleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
            Удалить
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
