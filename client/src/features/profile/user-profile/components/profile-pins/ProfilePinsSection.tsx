import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader2, Pencil, Pin, Trash2 } from "lucide-react";
import { usePulseProfileTheme } from "@/features/profile/pulse-profile";
import { PulseProfileHighlightTile } from "@/features/profile/pulse-profile";
import { resolveUrl } from "@/lib/api-base";
import {
  addProfilePinItem,
  createProfilePinFolder,
  deleteProfilePinFolder,
  deleteProfilePinItem,
  fetchProfilePinFolderDetail,
  fetchProfilePinFolders,
  updateProfilePinFolder,
  type ProfilePinFolderSummary,
  type ProfilePinItemRow,
} from "@/lib/profile-pins";
import { uploadPostMedia } from "@/lib/posts";
import { isVideoMediaUrl } from "../../utils/post-media";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PinCoverThumb } from "./PinCoverThumb";
import type { FeedPost } from "@/lib/posts";

const QK = (profileRouteId: string) => ["profile-pins", profileRouteId] as const;

type PinAdd =
  | { kind: "post"; post: FeedPost }
  | { kind: "story"; storyId: string }
  | null;

export function ProfilePinsSection({
  profileRouteId,
  isMe,
  onHighlightNew,
  pinAdd,
  onClearPinAdd,
  onOpenPinnedPost,
  onOpenPinnedStory,
}: {
  profileRouteId: string;
  isMe: boolean;
  onHighlightNew?: () => void;
  pinAdd: PinAdd;
  onClearPinAdd: () => void;
  onOpenPinnedPost: (postId: string) => void;
  onOpenPinnedStory: (storyId: string) => void;
}) {
  const { th } = usePulseProfileTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const longPressTimer = useRef<number | null>(null);

  const [folderOpenId, setFolderOpenId] = useState<string | null>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);

  const { data: folders = [], isLoading, isError, refetch } = useQuery({
    queryKey: QK(profileRouteId),
    queryFn: () => fetchProfilePinFolders(profileRouteId),
    enabled: !!profileRouteId,
    staleTime: 30_000,
  });

  const { data: folderDetail, isFetching: detailLoading } = useQuery({
    queryKey: ["profile-pins", "folder", folderOpenId],
    queryFn: () => fetchProfilePinFolderDetail(folderOpenId!),
    enabled: !!folderOpenId,
  });

  useEffect(() => {
    if (pinAdd) setAddSheetOpen(true);
  }, [pinAdd]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: QK(profileRouteId) });
  }, [qc, profileRouteId]);

  const addItemMut = useMutation({
    mutationFn: async ({ folderId, kind, refId }: { folderId: string; kind: "post" | "story"; refId: string }) => {
      await addProfilePinItem(folderId, kind, refId);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Добавлено в закреплённое" });
      setAddSheetOpen(false);
      onClearPinAdd();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const createFolderMut = useMutation({
    mutationFn: async ({ name, attach }: { name: string; attach: PinAdd }) => {
      const row = (await createProfilePinFolder({ name })) as { id: string };
      if (attach?.kind === "post") await addProfilePinItem(row.id, "post", attach.post.id);
      else if (attach?.kind === "story") await addProfilePinItem(row.id, "story", attach.storyId);
      return { attached: !!attach };
    },
    onSuccess: (data) => {
      invalidate();
      setNewFolderName("");
      toast({
        title: data.attached ? "Папка создана и контент добавлен" : "Папка создана",
      });
      setAddSheetOpen(false);
      onClearPinAdd();
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteFolderMut = useMutation({
    mutationFn: (id: string) => deleteProfilePinFolder(id),
    onSuccess: () => {
      invalidate();
      setFolderOpenId(null);
      toast({ title: "Папка удалена" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteProfilePinItem(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", folderOpenId] });
      invalidate();
      toast({ title: "Удалено из папки" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateFolderMut = useMutation({
    mutationFn: async (payload: { id: string; patch: Record<string, unknown> }) => {
      await updateProfilePinFolder(payload.id, payload.patch);
    },
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", folderOpenId] });
      setEditOpen(false);
      toast({ title: "Сохранено" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onFolderPointerDown = (folder: ProfilePinFolderSummary) => {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      const d = folder.description?.trim();
      if (d) {
        toast({ title: folder.name, description: d.slice(0, 500) });
      } else {
        toast({ title: folder.name, description: "Описание не задано" });
      }
    }, 520);
  };

  const openEdit = () => {
    if (!folderDetail?.folder) return;
    setEditFolderId(folderDetail.folder.id);
    setEditName(folderDetail.folder.name);
    setEditDesc(folderDetail.folder.description ?? "");
    setEditOpen(true);
  };

  useEffect(() => () => clearLongPress(), []);

  const handleCoverFile = async (file: File | null) => {
    if (!file || !editFolderId) return;
    setCoverBusy(true);
    try {
      const url = await uploadPostMedia(file);
      await updateProfilePinFolder(editFolderId, {
        coverUrl: url,
        coverIsVideo: isVideoMediaUrl(url),
      });
      invalidate();
      void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", folderOpenId] });
      toast({ title: "Обложка обновлена" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Не удалось загрузить", variant: "destructive" });
    } finally {
      setCoverBusy(false);
    }
  };

  const renderTile = (folder: ProfilePinFolderSummary) => {
    const preview = folder.displayPreviewUrl;
    const isVid = folder.displayIsVideo;
    return (
      <button
        key={folder.id}
        type="button"
        className="flex min-w-[4rem] shrink-0 flex-col items-center gap-1.5"
        onClick={() => setFolderOpenId(folder.id)}
        onPointerDown={() => onFolderPointerDown(folder)}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
      >
        <PinCoverThumb url={preview} isVideo={isVid} label={folder.name} empty={!preview} />
        <span style={{ fontSize: 10, color: th.text, fontWeight: 400 }} className="max-w-[72px] truncate text-center">
          {folder.name}
        </span>
      </button>
    );
  };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2 px-4">
        <div style={{ width: 3, height: 12, borderRadius: 2, background: th.accent }} aria-hidden />
        <span style={{ fontSize: 11, fontWeight: 700, color: th.text, letterSpacing: "0.07em" }}>ЗАКРЕПЛЁННОЕ</span>
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin opacity-60" style={{ color: th.text }} /> : null}
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pb-1 hide-scrollbar">
        {isError ? (
          <button
            type="button"
            className="text-xs underline opacity-80"
            style={{ color: th.accent }}
            onClick={() => void refetch()}
          >
            Не удалось загрузить — нажмите, чтобы повторить
          </button>
        ) : null}

        {!isLoading && folders.length === 0 ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-dashed px-3 py-3" style={{ borderColor: th.border }}>
            <div className="flex items-start gap-2">
              <Pin className="mt-0.5 h-4 w-4 shrink-0 opacity-70" style={{ color: th.accent }} />
              <p className="text-left text-[11px] leading-snug" style={{ color: th.text, opacity: 0.82 }}>
                {isMe
                  ? "Пока папок нет. Нажмите «Создать папку» или добавьте пост в закреплённое через меню «⋯» у своей публикации."
                  : "У пользователя пока нет закреплённых папок."}
              </p>
            </div>
          </div>
        ) : null}

        {folders.map(renderTile)}

        {isMe ? (
          <button
            type="button"
            className="flex min-w-[4rem] shrink-0 flex-col items-center gap-1.5"
            onClick={() => {
              setNewFolderName("");
              setAddSheetOpen(true);
              onClearPinAdd();
            }}
          >
            <PinCoverThumb url={null} isVideo={false} label="Новая папка" empty />
            <span style={{ fontSize: 10, color: th.text, fontWeight: 400 }}>Создать</span>
          </button>
        ) : null}

        {isMe && onHighlightNew ? (
          <PulseProfileHighlightTile label="Сториз" emoji="" hasContent={false} onClick={onHighlightNew} />
        ) : null}
      </div>

      {/* Добавить в папку / создать */}
      <Sheet
        open={addSheetOpen}
        onOpenChange={(o) => {
          setAddSheetOpen(o);
          if (!o) onClearPinAdd();
        }}
      >
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>
              {pinAdd?.kind === "post"
                ? "Закрепить пост"
                : pinAdd?.kind === "story"
                  ? "Закрепить сториз"
                  : "Новая папка"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            {pinAdd ? (
              <p className="text-sm text-muted-foreground">
                Выберите папку или создайте новую — контент добавится в конец по времени.
              </p>
            ) : null}
            <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
              {folders.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[var(--uix-touch-min)] justify-start py-2 text-left"
                  disabled={addItemMut.isPending}
                  onClick={() => {
                    if (!pinAdd) return;
                    if (pinAdd.kind === "post") {
                      addItemMut.mutate({ folderId: f.id, kind: "post", refId: pinAdd.post.id });
                    } else {
                      addItemMut.mutate({ folderId: f.id, kind: "story", refId: pinAdd.storyId });
                    }
                  }}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{f.itemCount}</span>
                </Button>
              ))}
            </div>
            <div className="flex gap-2 border-t pt-3">
              <Input
                placeholder="Название новой папки"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value.slice(0, 80))}
                maxLength={80}
              />
              <Button
                type="button"
                disabled={!newFolderName.trim() || createFolderMut.isPending}
                onClick={() => createFolderMut.mutate({ name: newFolderName.trim(), attach: pinAdd })}
              >
                <FolderPlus className="mr-1 h-4 w-4" />
                Создать
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Детали папки */}
      <Sheet open={!!folderOpenId} onOpenChange={(o) => !o && setFolderOpenId(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="pr-8">{folderDetail?.folder.name ?? "Папка"}</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin opacity-50" />
            </div>
          ) : folderDetail ? (
            <div className="mt-4 flex flex-col gap-3">
              {isMe && folderDetail.folder.ownerUserId ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={openEdit}>
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    Редактировать
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm("Удалить папку и всё содержимое?")) {
                        deleteFolderMut.mutate(folderDetail.folder.id);
                      }
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Удалить папку
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">Порядок: по дате добавления. Сверху — раньше добавленные.</p>
              <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
                {folderDetail.items.map((it: ProfilePinItemRow) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2"
                  >
                    <button
                      type="button"
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/30"
                      onClick={() => {
                        if (it.kind === "post") onOpenPinnedPost(it.refId);
                        else onOpenPinnedStory(it.refId);
                      }}
                    >
                      {it.previewUrl ? (
                        it.isVideo ? (
                          <video
                            src={resolveUrl(it.previewUrl)}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img src={resolveUrl(it.previewUrl)} alt="" className="h-full w-full object-cover" />
                        )
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-medium">{it.kind === "post" ? "Пост" : "Сториз"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        👁 {it.viewsCount} · ❤️ {it.likesCount}
                      </div>
                    </div>
                    {isMe ? (
                      <div className="flex shrink-0 flex-col gap-1">
                        {it.previewUrl ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => {
                              if (!folderDetail.folder.id) return;
                              updateFolderMut.mutate({
                                id: folderDetail.folder.id,
                                patch: { coverUrl: it.previewUrl, coverIsVideo: it.isVideo },
                              });
                            }}
                          >
                            Обложка
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label="Удалить из папки"
                          onClick={() => {
                            if (window.confirm("Убрать из закреплённого?")) deleteItemMut.mutate(it.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {folderDetail.items.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">В папке пока пусто</p>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Редактирование папки */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="max-h-[88vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Папка</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-3">
            <label className="text-xs text-muted-foreground">Название</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value.slice(0, 80))} maxLength={80} />
            <label className="text-xs text-muted-foreground">Описание (до 500 символов, удерживайте папку на профиле)</label>
            <textarea
              className="min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value.slice(0, 500))}
              maxLength={500}
            />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Обложка (фото или видео с устройства)</p>
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                className="text-sm"
                disabled={coverBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void handleCoverFile(f);
                }}
              />
              {coverBusy ? <Loader2 className="mt-2 h-4 w-4 animate-spin" /> : null}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => editFolderId && updateFolderMut.mutate({ id: editFolderId, patch: { coverUrl: null } })}
            >
              Сбросить обложку
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!editFolderId) return;
                updateFolderMut.mutate({
                  id: editFolderId,
                  patch: { name: editName.trim(), description: editDesc.trim() || null },
                });
              }}
              disabled={!editName.trim()}
            >
              Сохранить
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
