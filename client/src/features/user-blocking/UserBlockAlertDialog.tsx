import { useState, useEffect } from "react";
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
import type { BlockPresetId } from "./types";
import { USER_BLOCK_NOTE_MAX } from "./types";
import { BlockPresetCatalog } from "./BlockPresetCatalog";
import { UserBlockSubmitter } from "./UserBlockSubmitter";
import { UserBlockPresetFields } from "./UserBlockPresetFields";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
  targetDisplayName?: string | null;
  /** Стартовый пресет (например из чата — «только сообщения»). */
  initialPreset?: BlockPresetId;
  /** Не закрывать оверлей меню чата при открытии диалога */
  nestedInChatMenu?: boolean;
  onBlocked?: () => void;
};

export function UserBlockAlertDialog({
  open,
  onOpenChange,
  targetUserId,
  targetDisplayName,
  initialPreset = "chatOnly",
  nestedInChatMenu,
  onBlocked,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [preset, setPreset] = useState<BlockPresetId>(initialPreset);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setPreset(initialPreset);
      setNote("");
    }
  }, [open, initialPreset]);

  const summary = BlockPresetCatalog.summary(preset);
  const titleHint = targetDisplayName?.trim()
    ? `Пользователь «${targetDisplayName.trim()}». ${summary}`
    : `Пользователь. ${summary}`;

  const submit = async () => {
    if (!targetUserId) return;
    setBusy(true);
    try {
      const flags = BlockPresetCatalog.flags(preset);
      const noteTrim = note.trim();
      await UserBlockSubmitter.submit(targetUserId, flags, noteTrim.length ? noteTrim : null);
      toast({ title: "Пользователь заблокирован", description: summary });
      onOpenChange(false);
      onBlocked?.();
    } catch (e) {
      toast({
        title: "Не удалось заблокировать",
        description: e instanceof Error ? e.message : "Ошибка",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-chat-detail-keep-menu-open={nestedInChatMenu ? "1" : undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>Заблокировать пользователя?</AlertDialogTitle>
          <AlertDialogDescription>{titleHint}</AlertDialogDescription>
        </AlertDialogHeader>
        <UserBlockPresetFields value={preset} onChange={setPreset} disabled={busy} />
        <label className="mt-3 block px-0.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Комментарий для собеседника (необязательно)
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, USER_BLOCK_NOTE_MAX))}
            disabled={busy}
            rows={2}
            placeholder="Например: нежелательные сообщения"
            className="mt-1.5 w-full resize-none rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {busy ? "…" : "Заблокировать"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
