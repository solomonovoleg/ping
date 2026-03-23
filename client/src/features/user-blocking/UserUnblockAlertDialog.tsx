import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { UserUnblockSubmitter } from "./UserUnblockSubmitter";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
  targetDisplayName?: string | null;
  nestedInChatMenu?: boolean;
  onUnblocked?: () => void;
};

export function UserUnblockAlertDialog({
  open,
  onOpenChange,
  targetUserId,
  targetDisplayName,
  nestedInChatMenu,
  onUnblocked,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!targetUserId) return;
    setBusy(true);
    try {
      await UserUnblockSubmitter.submit(targetUserId);
      toast({ title: "Блокировка снята" });
      onOpenChange(false);
      onUnblocked?.();
    } catch (e) {
      toast({
        title: "Не удалось снять блокировку",
        description: e instanceof Error ? e.message : "Ошибка",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const who = targetDisplayName?.trim() ? `«${targetDisplayName.trim()}»` : "этого пользователя";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-chat-detail-keep-menu-open={nestedInChatMenu ? "1" : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>Снять блокировку?</AlertDialogTitle>
          <AlertDialogDescription>
            Снимаются все ваши ограничения для {who}: переписка, профиль и активность в ленте — как до блокировки.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void submit(); }}>
            {busy ? "…" : "Снять"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
