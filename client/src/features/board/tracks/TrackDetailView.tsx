/**
 * Детальный вид трека: список сообщений с разделением выполнено/не выполнено.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, List, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { getTrackItems, setTrackItemDone, removeTrackItem, updateTrack, deleteTrack } from "@/lib/tracks";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackItemRow } from "./TrackItemRow";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type TrackDetailViewProps = {
  trackId: string;
  trackName: string;
};

export function TrackDetailView({ trackId, trackName }: TrackDetailViewProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tracks", trackId, "items"],
    queryFn: () => getTrackItems(trackId),
  });

  const doneMutation = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) => setTrackItemDone(trackId, itemId, done),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", trackId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeTrackItem(trackId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks", trackId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось убрать", variant: "destructive" });
    },
  });

  const handleDone = (itemId: string, done: boolean) => {
    doneMutation.mutate({ itemId, done });
  };

  const handleOpenChat = (chatId: string, messageId?: string) => {
    const url = messageId
      ? `/chat/${encodeURIComponent(chatId)}?messageId=${encodeURIComponent(messageId)}`
      : `/chat/${encodeURIComponent(chatId)}`;
    setLocation(url);
  };

  const handleRemove = (itemId: string) => {
    removeMutation.mutate(itemId);
  };

  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState(trackName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (name: string) => updateTrack(trackId, name),
    onSuccess: (_, newName) => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", trackId, "meta"] });
      setShowRename(false);
      setRenameValue(newName);
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось переименовать", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTrack(trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      setLocation("/board/tracks");
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось удалить", variant: "destructive" });
    },
  });

  const handleRenameSubmit = () => {
    const name = renameValue.trim() || trackName;
    if (name !== trackName) updateMutation.mutate(name);
    else setShowRename(false);
  };

  const activeItems = items.filter((i) => !i.doneAt);
  const doneItems = items.filter((i) => !!i.doneAt);
  const totalItems = items.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex justify-between items-center border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board/tracks")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center flex-shrink-0"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <div className="min-w-0">
            <h1 className="uix-text-title truncate">{trackName}</h1>
            {totalItems > 0 && (
              <span className="text-[12px] text-muted-foreground">
                {totalItems} {totalItems === 1 ? "сообщение" : totalItems < 5 ? "сообщения" : "сообщений"}
                {" · "}{activeItems.length} активн{activeItems.length === 1 ? "ое" : "ых"} / {doneItems.length} закрыто
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TapScaleButton
              type="button"
              haptic
              subtle
              className="p-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center flex-shrink-0"
              aria-label="Меню трека"
            >
              <MoreVertical className="w-5 h-5" />
            </TapScaleButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setRenameValue(trackName); setShowRename(true); }}>
              <Pencil className="w-4 h-4 mr-2" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Удалить трек
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Переименовать трек</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Название"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") setShowRename(false);
              }}
              autoFocus
            />
            <TapScaleButton
              type="button"
              onClick={handleRenameSubmit}
              disabled={updateMutation.isPending}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shrink-0"
            >
              Готово
            </TapScaleButton>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить трек?</AlertDialogTitle>
            <AlertDialogDescription>
              Все сообщения в треке будут убраны. Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex-1 overflow-y-auto pb-[var(--uix-nav-bottom)]">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}
        {error && (
          <div className="p-6">
            <p className="text-sm text-destructive mb-3">Не удалось загрузить</p>
            <TapScaleButton
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Повторить
            </TapScaleButton>
          </div>
        )}
        {!isLoading && !error && items.length === 0 && (
          <ListEmptyState
            icon={List}
            title="Нет сообщений"
            description="Добавляйте сообщения из чатов через меню «В трек»"
            className="min-h-[200px]"
          />
        )}
        {!isLoading && !error && items.length > 0 && (
          <div className="divide-y divide-border/40">
            {activeItems.length > 0 && (
              <section>
                <div className="px-4 py-2 bg-muted/30">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Активные ({activeItems.length})
                  </h3>
                </div>
                {activeItems.map((item) => (
                  <TrackItemRow
                    key={item.id}
                    item={item}
                    onDone={handleDone}
                    onRemove={handleRemove}
                    onOpenChat={handleOpenChat}
                  />
                ))}
              </section>
            )}
            {doneItems.length > 0 && (
              <section>
                <div className="px-4 py-2 bg-muted/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Выполнено ({doneItems.length})
                  </h3>
                </div>
                {doneItems.map((item) => (
                  <TrackItemRow
                    key={item.id}
                    item={item}
                    onDone={handleDone}
                    onRemove={handleRemove}
                    onOpenChat={handleOpenChat}
                  />
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
