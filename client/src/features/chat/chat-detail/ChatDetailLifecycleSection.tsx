import { useState } from "react";
import { LogOut, Trash2, Users, UserX } from "lucide-react";
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
import { setUserBlock, USER_BLOCK_PRESETS } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";

type Props = {
  chatId: string;
  chatType: "dm" | "group";
  isGroupAdmin: boolean;
  targetUserId?: string | null;
  targetDisplayName?: string | null;
  onDone: () => void;
  onNavigateAway: () => void;
};

export function ChatDetailLifecycleSection({
  chatId,
  chatType,
  isGroupAdmin,
  targetUserId,
  targetDisplayName,
  onDone,
  onNavigateAway,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [blockPreset, setBlockPreset] = useState<"chatOnly" | "socialOnly" | "full">("chatOnly");

  const blockDescription =
    blockPreset === "full"
      ? "Он не сможет писать вам, видеть профиль и взаимодействовать в ленте."
      : blockPreset === "socialOnly"
        ? "Он не сможет ставить реакции и оставлять комментарии у вас."
        : "Он не сможет писать вам в личку.";

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

  return (
    <>
      {chatType === "dm" && targetUserId ? (
        <div className="mt-3 border-t border-border/60 pt-3 space-y-1">
          <p className="px-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Пользователь</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmBlock(true)}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm transition-colors hover:bg-destructive/10 text-destructive"
          >
            <UserX className="h-5 w-5 shrink-0" />
            <span className="flex-1 font-medium">Заблокировать</span>
          </button>
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
                ? "Вы выйдите из группы. Историю смогут видеть оставшиеся участники."
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

      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent data-chat-detail-keep-menu-open="1">
          <AlertDialogHeader>
            <AlertDialogTitle>Заблокировать пользователя?</AlertDialogTitle>
            <AlertDialogDescription>
              {targetDisplayName?.trim()
                ? `Пользователь «${targetDisplayName.trim()}». ${blockDescription}`
                : `Пользователь. ${blockDescription}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setBlockPreset("chatOnly")}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                blockPreset === "chatOnly"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 hover:bg-secondary/60"
              }`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  blockPreset === "chatOnly" ? "bg-primary" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block font-medium">Только сообщения</span>
                <span className="block text-xs text-muted-foreground">Не сможет писать вам в личку.</span>
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setBlockPreset("socialOnly")}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                blockPreset === "socialOnly"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 hover:bg-secondary/60"
              }`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  blockPreset === "socialOnly" ? "bg-primary" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block font-medium">Только активность</span>
                <span className="block text-xs text-muted-foreground">Запретить реакции и комментарии.</span>
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setBlockPreset("full")}
              className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                blockPreset === "full"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 hover:bg-secondary/60"
              }`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  blockPreset === "full" ? "bg-primary" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
              <span className="flex-1">
                <span className="block font-medium">Полная блокировка</span>
                <span className="block text-xs text-muted-foreground">
                  Сообщения, профиль и активность будут недоступны.
                </span>
              </span>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!targetUserId) return;
                setBusy(true);
                try {
                  await setUserBlock(targetUserId, USER_BLOCK_PRESETS[blockPreset]);
                  toast({ title: "Пользователь заблокирован", description: blockDescription });
                  onDone();
                } catch (e) {
                  toast({
                    title: "Не удалось заблокировать",
                    description: e instanceof Error ? e.message : "Ошибка",
                    variant: "destructive",
                  });
                } finally {
                  setBusy(false);
                  setConfirmBlock(false);
                }
              }}
            >
              {busy ? "…" : "Заблокировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
