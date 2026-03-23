import { useState } from "react";
import { LogOut, Trash2, Users, UserCheck, UserX } from "lucide-react";
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
import { deleteChatForEveryone, deleteChatForMe } from "@/lib/chat";
import { UserBlockAlertDialog, UserUnblockAlertDialog } from "@/features/user-blocking";
import type { ApiChat } from "@/features/chat";
import { useToast } from "@/hooks/use-toast";

type Props = {
  chatId: string;
  chatType: "dm" | "group";
  isGroupAdmin: boolean;
  targetUserId?: string | null;
  targetDisplayName?: string | null;
  myBlockOfOther?: ApiChat["myBlockOfOther"];
  /** После блока/разблока обновить карточку чата (blockedByOther / myBlockOfOther). */
  onRefreshChatMeta?: () => void;
  onDone: () => void;
  onNavigateAway: () => void;
};

export function ChatDetailLifecycleSection({
  chatId,
  chatType,
  isGroupAdmin,
  targetUserId,
  targetDisplayName,
  myBlockOfOther,
  onRefreshChatMeta,
  onDone,
  onNavigateAway,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmUnblock, setConfirmUnblock] = useState(false);
  const [confirmDeleteAfterBlock, setConfirmDeleteAfterBlock] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
      onNavigateAway();
    } catch (e) {
      toast({
        title: "Не удалось выполнить",
        description: e instanceof Error ? e.message : "Ошибка",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setConfirmLeave(false);
      setConfirmDeleteAll(false);
    }
  };

  const iBlockedThem = !!(myBlockOfOther?.restrictChat || myBlockOfOther?.restrictProfile || myBlockOfOther?.restrictSocial);

  return (
    <>
      {chatType === "dm" && targetUserId ? (
        <div className="mt-3 border-t border-border/60 pt-3 space-y-1">
          <p className="px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Пользователь</p>
          {iBlockedThem ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmUnblock(true)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-secondary/80"
            >
              <UserCheck className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-medium">Снять блокировку</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmBlock(true)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-destructive/10 text-destructive"
            >
              <UserX className="h-5 w-5 shrink-0" />
              <span className="flex-1 font-medium">Заблокировать</span>
            </button>
          )}
        </div>
      ) : null}
      <div className="mt-3 border-t border-border/60 pt-3 space-y-1">
        <p className="px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Чат</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmLeave(true)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-secondary/70"
        >
          <LogOut className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="flex-1 font-medium">
            {chatType === "group" ? "Покинуть группу" : "Удалить чат у себя"}
          </span>
        </button>
        <button
          type="button"
          disabled={busy || (chatType === "group" && !isGroupAdmin)}
          onClick={() => setConfirmDeleteAll(true)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-destructive/10 text-destructive"
        >
          <Trash2 className="h-5 w-5 shrink-0" />
          <span className="flex-1 font-medium">
            {chatType === "group" ? "Удалить группу у всех" : "Удалить чат у обоих"}
          </span>
        </button>
        {chatType === "group" && !isGroupAdmin ? (
          <p className="px-2 text-[11px] text-muted-foreground">Удалить группу для всех может только администратор.</p>
        ) : null}
      </div>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent data-chat-detail-keep-menu-open="1">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {chatType === "group" ? "Покинуть группу?" : "Удалить чат у себя?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chatType === "group"
                ? "Вы выйдете из группы. Историю смогут видеть оставшиеся участники."
                : "Диалог пропадёт из списка. Собеседник сможет написать снова — откроется новый чат."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => run(() => deleteChatForMe(chatId))}>
              {busy ? "…" : "Да"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent data-chat-detail-keep-menu-open="1">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Удалить для всех?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {chatType === "group"
                ? "Группа и переписка будут удалены для всех участников. Действие необратимо."
                : "Чат и сообщения удалятся у вас и у собеседника. Действие необратимо."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => run(() => deleteChatForEveryone(chatId))}
            >
              {busy ? "…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserBlockAlertDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        targetUserId={targetUserId ?? null}
        targetDisplayName={targetDisplayName}
        initialPreset="chatOnly"
        nestedInChatMenu
        onBlocked={() => {
          onRefreshChatMeta?.();
          onDone();
          setConfirmDeleteAfterBlock(true);
        }}
      />

      <UserUnblockAlertDialog
        open={confirmUnblock}
        onOpenChange={setConfirmUnblock}
        targetUserId={targetUserId ?? null}
        targetDisplayName={targetDisplayName}
        nestedInChatMenu
        onUnblocked={() => {
          onRefreshChatMeta?.();
          onDone();
        }}
      />

      <AlertDialog open={confirmDeleteAfterBlock} onOpenChange={setConfirmDeleteAfterBlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат у себя?</AlertDialogTitle>
            <AlertDialogDescription>
              Чат останется у собеседника, но у вас исчезнет из списка. Позже можно написать снова — откроется новый диалог.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy}
              onClick={() => {
                setConfirmDeleteAfterBlock(false);
              }}
            >
              Нет, оставить
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void deleteChatForMe(chatId)
                  .then(() => {
                    setConfirmDeleteAfterBlock(false);
                    onNavigateAway();
                  })
                  .catch((e) => {
                    toast({
                      title: "Не удалось удалить чат",
                      description: e instanceof Error ? e.message : "Ошибка",
                      variant: "destructive",
                    });
                  })
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "…" : "Да, удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
