/**
 * Страница списка треков пользователя.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ChevronLeft, List, Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { getTracks, createTrack, updateTrack, deleteTrack } from "@/lib/tracks";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
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

export function TracksListPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createName, setCreateName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [renameTrack, setRenameTrack] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTrackId, setDeleteTrackId] = useState<string | null>(null);

  const { data: tracks = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tracks"],
    queryFn: getTracks,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => createTrack(name),
    onSuccess: (track) => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      setCreateName("");
      setShowCreate(false);
      setLocation(`/board/tracks/${encodeURIComponent(track.id)}`);
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось создать", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    const name = createName.trim() || "Новый трек";
    createMutation.mutate(name);
  };

  const updateMutation = useMutation({
    mutationFn: ({ trackId, name }: { trackId: string; name: string }) => updateTrack(trackId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      setRenameTrack(null);
      setRenameValue("");
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось переименовать", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (trackId: string) => deleteTrack(trackId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      setDeleteTrackId(null);
      setLocation("/board/tracks");
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось удалить", variant: "destructive" });
    },
  });

  const handleRenameSubmit = () => {
    if (!renameTrack) return;
    const name = renameValue.trim() || renameTrack.name;
    if (name === renameTrack.name) {
      setRenameTrack(null);
      setRenameValue("");
      return;
    }
    updateMutation.mutate({ trackId: renameTrack.id, name });
  };

  const openRename = (track: { id: string; name: string }) => {
    setRenameTrack(track);
    setRenameValue(track.name);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex justify-between items-center border-b border-border/50">
        <div className="flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <h1 className="uix-text-title">Треки</h1>
        </div>
        <TapScaleButton
          type="button"
          onClick={() => setShowCreate(true)}
          haptic
          subtle
          className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
          aria-label="Создать трек"
        >
          <Plus className="w-5 h-5" />
        </TapScaleButton>
      </div>

      <div className="flex-1 overflow-y-auto pb-[var(--uix-nav-bottom)]">
        {showCreate && (
          <div className="p-4 border-b border-border/50 bg-muted/20">
            <div className="flex gap-2">
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Название трека"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setShowCreate(false);
                }}
                autoFocus
              />
              <TapScaleButton
                type="button"
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                Создать
              </TapScaleButton>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        )}
        {error && (
          <div className="p-6">
            <p className="text-sm text-destructive mb-3">Не удалось загрузить треки</p>
            <TapScaleButton
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Повторить
            </TapScaleButton>
          </div>
        )}
        {!isLoading && !error && tracks.length === 0 && !showCreate && (
          <ListEmptyState
            icon={List}
            title="Нет треков"
            description="Создайте первый трек, чтобы собирать сообщения из чатов"
            actionLabel="Создать трек"
            onAction={() => setShowCreate(true)}
            className="min-h-[200px]"
          />
        )}
        {!isLoading && !error && tracks.length > 0 && (
          <ul className="divide-y divide-border/40">
            {tracks.map((track) => (
              <li key={track.id}>
                <div className="flex items-center gap-1 min-h-[var(--uix-touch-min)]">
                  <TapScaleButton
                    type="button"
                    onClick={() => setLocation(`/board/tracks/${encodeURIComponent(track.id)}`)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-h-[var(--uix-touch-min)] hover:bg-secondary/80 active:bg-secondary/60 transition-colors"
                  >
                    <List className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[15px] font-medium truncate block">{track.name}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {track.totalItems} {track.totalItems === 1 ? "сообщение" : track.totalItems < 5 ? "сообщения" : "сообщений"}
                        {track.totalItems > 0 && (
                          <> · {track.activeItems} активн{track.activeItems === 1 ? "ое" : "ых"} / {track.doneItems} закрыто</>
                        )}
                      </span>
                    </div>
                    <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180 flex-shrink-0" />
                  </TapScaleButton>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <TapScaleButton
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        haptic
                        subtle
                        className="p-2 rounded-full hover:bg-secondary/80 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center flex-shrink-0"
                        aria-label="Меню трека"
                      >
                        <MoreVertical className="w-5 h-5 text-muted-foreground" />
                      </TapScaleButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openRename(track)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteTrackId(track.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!renameTrack} onOpenChange={(open) => !open && setRenameTrack(null)}>
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
                if (e.key === "Escape") setRenameTrack(null);
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

      <AlertDialog open={!!deleteTrackId} onOpenChange={(open) => !open && setDeleteTrackId(null)}>
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
              onClick={() => deleteTrackId && deleteMutation.mutate(deleteTrackId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
