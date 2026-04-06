import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, Loader2, Pencil, Pin, Trash2 } from "lucide-react";
import { usePulseProfileTheme } from "@/features/profile/pulse-profile";
import { PulseProfileHighlightTile } from "@/features/profile/pulse-profile";
import { triggerLightHaptic } from "@/lib/capacitor-native";
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
import { uploadPostMedia, type PostVideoTrimUpload } from "@/lib/posts";
import { POST_VIDEO_MAX_SECONDS } from "@shared/post-video";
import { PostVideoTrimmerModal } from "@/features/posts/video-trim/PostVideoTrimmerModal";
import { isVideoMediaUrl } from "../../utils/post-media";
import { useToast } from "@/hooks/use-toast";
import { ErrorWithRetry } from "@/components/ui/empty";
import { UploadProgressBlockingOverlay } from "@/components/ui/upload-progress-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PinCoverThumb } from "./PinCoverThumb";
import { PinFolderDescriptionBubble, type PinFolderDescriptionBubblePayload } from "./PinFolderDescriptionBubble";
import { ProfilePinFolderViewer } from "./ProfilePinFolderViewer";
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
  profilePinnedPostId = null,
  profilePinnedPreview = null,
}: {
  profileRouteId: string;
  isMe: boolean;
  onHighlightNew?: () => void;
  pinAdd: PinAdd;
  onClearPinAdd: () => void;
  onOpenPinnedPost: (postId: string) => void;
  onOpenPinnedStory: (storyId: string) => void;
  /** Пост в шапке профиля (`users.pinned_post_id`), не папка. */
  profilePinnedPostId?: string | null;
  profilePinnedPreview?: { url: string | null; isVideo: boolean } | null;
}) {
  const { th } = usePulseProfileTheme();
  const { toast } = useToast();
  const qc = useQueryClient();
  const longPressTimer = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const folderMediaInputRef = useRef<HTMLInputElement | null>(null);

  const [viewerFolderId, setViewerFolderId] = useState<string | null>(null);
  const [manageFolderId, setManageFolderId] = useState<string | null>(null);
  const [descBubble, setDescBubble] = useState<PinFolderDescriptionBubblePayload>(null);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [folderMediaVideoFile, setFolderMediaVideoFile] = useState<File | null>(null);
  const [folderMediaTrimOpen, setFolderMediaTrimOpen] = useState(false);
  const [folderMediaBusy, setFolderMediaBusy] = useState(false);
  const [coverVideoFile, setCoverVideoFile] = useState<File | null>(null);
  const [coverTrimOpen, setCoverTrimOpen] = useState(false);
  const [pinUploadPercent, setPinUploadPercent] = useState<number | null>(null);

  const { data: folders = [], isLoading, isError, refetch } = useQuery({
    queryKey: QK(profileRouteId),
    queryFn: () => fetchProfilePinFolders(profileRouteId),
    enabled: !!profileRouteId,
    staleTime: 30_000,
  });

  const detailId = manageFolderId ?? viewerFolderId;
  const {
    data: folderDetail,
    isFetching: detailLoading,
    isError: detailError,
    refetch: refetchFolderDetail,
  } = useQuery({
    queryKey: ["profile-pins", "folder", detailId],
    queryFn: () => fetchProfilePinFolderDetail(detailId!),
    enabled: !!detailId,
  });

  useEffect(() => {
    if (pinAdd) setAddSheetOpen(true);
  }, [pinAdd]);

  useEffect(() => {
    if (addSheetOpen && profileRouteId) void refetch();
  }, [addSheetOpen, profileRouteId, refetch]);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: QK(profileRouteId) });
  }, [qc, profileRouteId]);

  const addItemMut = useMutation({
    mutationFn: async (args: { folderId: string; kind: "post"; refId: string } | { folderId: string; kind: "story"; refId: string }) => {
      const { folderId, kind, refId } = args;
      await addProfilePinItem(folderId, { kind, refId });
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
      if (attach?.kind === "post") await addProfilePinItem(row.id, { kind: "post", refId: attach.post.id });
      else if (attach?.kind === "story") await addProfilePinItem(row.id, { kind: "story", refId: attach.storyId });
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
      setViewerFolderId(null);
      setManageFolderId(null);
      toast({ title: "Папка удалена" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteItemMut = useMutation({
    mutationFn: (id: string) => deleteProfilePinItem(id),
    onSuccess: () => {
      const fid = folderDetail?.folder.id ?? manageFolderId;
      if (fid) void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", fid] });
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
      const fid = folderDetail?.folder.id;
      if (fid) void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", fid] });
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

  const openEdit = () => {
    if (!folderDetail?.folder) return;
    setEditFolderId(folderDetail.folder.id);
    setEditName(folderDetail.folder.name);
    setEditDesc(folderDetail.folder.description ?? "");
    setEditOpen(true);
  };

  useEffect(() => () => clearLongPress(), []);

  const uploadFolderCover = useCallback(
    async (file: File, trim?: PostVideoTrimUpload) => {
      if (!editFolderId) return;
      setCoverBusy(true);
      setPinUploadPercent(0);
      try {
        const url = await uploadPostMedia(file, trim, { onProgress: (p) => setPinUploadPercent(p) });
        await updateProfilePinFolder(editFolderId, {
          coverUrl: url,
          coverIsVideo: isVideoMediaUrl(url),
        });
        invalidate();
        const fid = folderDetail?.folder.id ?? detailId;
        if (fid) void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", fid] });
        toast({ title: "Обложка обновлена" });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось загрузить", variant: "destructive" });
      } finally {
        setCoverBusy(false);
        setPinUploadPercent(null);
      }
    },
    [editFolderId, detailId, folderDetail?.folder.id, invalidate, qc, toast],
  );

  const handleCoverFilePick = useCallback(
    async (file: File | null) => {
      if (!file || !editFolderId) return;
      const looksVideo =
        (file.type && file.type.startsWith("video/")) || /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name || "");
      if (looksVideo) {
        setCoverVideoFile(file);
        setCoverTrimOpen(true);
        return;
      }
      await uploadFolderCover(file);
    },
    [editFolderId, uploadFolderCover],
  );

  const onCoverTrimConfirm = useCallback(
    async (trim: PostVideoTrimUpload) => {
      const f = coverVideoFile;
      if (!f) return;
      setCoverTrimOpen(false);
      setCoverVideoFile(null);
      await uploadFolderCover(f, trim);
    },
    [coverVideoFile, uploadFolderCover],
  );

  const looksLikeVideoFile = useCallback((file: File) => {
    if (file.type && file.type.startsWith("video/")) return true;
    return /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name || "");
  }, []);

  const onFolderMediaTrimConfirm = useCallback(
    async (trim: PostVideoTrimUpload) => {
      const file = folderMediaVideoFile;
      const fid = manageFolderId;
      if (!file || !fid) return;
      setFolderMediaBusy(true);
      setPinUploadPercent(0);
      try {
        const url = await uploadPostMedia(file, trim, { onProgress: (p) => setPinUploadPercent(p) });
        await addProfilePinItem(fid, { kind: "media", mediaUrl: url, mediaIsVideo: true });
        invalidate();
        void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", fid] });
        toast({ title: "Файл добавлен в папку" });
        setFolderMediaTrimOpen(false);
        setFolderMediaVideoFile(null);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось добавить", variant: "destructive" });
      } finally {
        setFolderMediaBusy(false);
        setPinUploadPercent(null);
      }
    },
    [folderMediaVideoFile, manageFolderId, invalidate, qc, toast],
  );

  const handleFolderMediaFile = useCallback(
    async (file: File | null) => {
      const fid = manageFolderId;
      if (!file || !fid) return;
      if (looksLikeVideoFile(file)) {
        setFolderMediaVideoFile(file);
        setFolderMediaTrimOpen(true);
        return;
      }
      setFolderMediaBusy(true);
      setPinUploadPercent(0);
      try {
        const url = await uploadPostMedia(file, undefined, { onProgress: (p) => setPinUploadPercent(p) });
        await addProfilePinItem(fid, { kind: "media", mediaUrl: url, mediaIsVideo: false });
        invalidate();
        void qc.invalidateQueries({ queryKey: ["profile-pins", "folder", fid] });
        toast({ title: "Файл добавлен в папку" });
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : "Не удалось добавить", variant: "destructive" });
      } finally {
        setFolderMediaBusy(false);
        setPinUploadPercent(null);
      }
    },
    [manageFolderId, invalidate, looksLikeVideoFile, qc, toast],
  );

  const dismissDescBubble = useCallback(() => setDescBubble(null), []);

  const onFolderPointerDown = (folder: ProfilePinFolderSummary, e: React.PointerEvent) => {
    longPressFiredRef.current = false;
    clearLongPress();
    const clientX = e.clientX;
    const clientY = e.clientY;
    longPressTimer.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      triggerLightHaptic();
      const d = folder.description?.trim();
      setDescBubble({
        title: folder.name,
        body: d && d.length > 0 ? d.slice(0, 500) : "Описание не задано",
        clientX,
        clientY,
      });
    }, 520);
  };

  const onFolderTileClick = (folder: ProfilePinFolderSummary) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    setDescBubble(null);
    setViewerFolderId(folder.id);
  };

  const viewerTitle =
    (viewerFolderId && folders.find((f) => f.id === viewerFolderId)?.name) ||
    (folderDetail?.folder.id === viewerFolderId ? folderDetail.folder.name : null) ||
    "Папка";
  const viewerItems =
    viewerFolderId && folderDetail?.folder.id === viewerFolderId ? folderDetail.items : [];
  const viewerLoading =
    !!viewerFolderId && !detailError && (!folderDetail || folderDetail.folder.id !== viewerFolderId || detailLoading);
  const viewerLoadError = !!viewerFolderId && detailError;

  const renderTile = (folder: ProfilePinFolderSummary) => {
    const preview = folder.displayPreviewUrl;
    const isVid = folder.displayIsVideo;
    return (
      <button
        key={folder.id}
        type="button"
        className="flex min-w-[4rem] shrink-0 flex-col items-center gap-1.5"
        onClick={() => onFolderTileClick(folder)}
        onPointerDown={(e) => onFolderPointerDown(folder, e)}
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

        {!isLoading && folders.length === 0 && !profilePinnedPostId ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-dashed px-3 py-3" style={{ borderColor: th.border }}>
            <div className="flex items-start gap-2">
              <Pin className="mt-0.5 h-4 w-4 shrink-0 opacity-70" style={{ color: th.accent }} />
              <p className="text-left text-[11px] leading-snug" style={{ color: th.text, opacity: 0.82 }}>
                {isMe
                  ? "Пока папок нет. Закрепите пост в шапке или в папку через «⋯» у публикации, либо нажмите «Создать»."
                  : "У пользователя пока нет закреплённых папок."}
              </p>
            </div>
          </div>
        ) : null}

        {profilePinnedPostId ? (
          <button
            type="button"
            className="flex min-w-[4rem] shrink-0 flex-col items-center gap-1.5"
            onClick={() => onOpenPinnedPost(profilePinnedPostId)}
          >
            <PinCoverThumb
              url={profilePinnedPreview?.url?.trim() ? profilePinnedPreview.url : null}
              isVideo={profilePinnedPreview?.isVideo === true}
              label="Пост в профиле"
              empty={!profilePinnedPreview?.url?.trim()}
            />
            <span
              style={{ fontSize: 10, color: th.text, fontWeight: 400 }}
              className="max-w-[72px] truncate text-center"
            >
              В профиле
            </span>
          </button>
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
            ) : (
              <p className="text-sm text-muted-foreground">
                Чтобы закрепить пост или сториз, откройте это окно из меню «⋯» у своей публикации или сториз — тогда
                здесь появятся ваши папки.
              </p>
            )}
            <div className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
              {folders.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-[var(--uix-touch-min)] justify-start py-2 text-left"
                  disabled={addItemMut.isPending || !pinAdd}
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

      <PinFolderDescriptionBubble payload={descBubble} onDismiss={dismissDescBubble} />

      {viewerFolderId ? (
        <ProfilePinFolderViewer
          key={viewerFolderId}
          open
          onClose={() => setViewerFolderId(null)}
          folderId={viewerFolderId}
          folderTitle={viewerTitle}
          items={viewerItems}
          loading={viewerLoading}
          loadError={viewerLoadError}
          onRetryLoad={() => void refetchFolderDetail()}
          isMe={isMe}
          onOpenManage={() => {
            const id = viewerFolderId;
            if (!id) return;
            setDescBubble(null);
            setManageFolderId(id);
            setViewerFolderId(null);
          }}
          onOpenPinnedPost={onOpenPinnedPost}
          onOpenPinnedStory={onOpenPinnedStory}
        />
      ) : null}

      {/* Управление папкой (список, загрузка, удаление) */}
      <Sheet open={!!manageFolderId} onOpenChange={(o) => !o && setManageFolderId(null)}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="pr-8">{folderDetail?.folder.name ?? "Папка"}</SheetTitle>
          </SheetHeader>
          {detailLoading && manageFolderId ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin opacity-50" />
            </div>
          ) : detailError && manageFolderId ? (
            <div className="py-6">
              <ErrorWithRetry
                onRetry={() => void refetchFolderDetail()}
                title="Не удалось загрузить папку"
                description="Проверьте сеть и попробуйте снова."
              />
            </div>
          ) : folderDetail && folderDetail.folder.id === manageFolderId ? (
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
                    variant="secondary"
                    disabled={folderMediaBusy}
                    onClick={() => folderMediaInputRef.current?.click()}
                  >
                    Фото или видео с устройства
                  </Button>
                  <input
                    ref={folderMediaInputRef}
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      void handleFolderMediaFile(f);
                    }}
                  />
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
                        else if (it.kind === "story") onOpenPinnedStory(it.refId);
                        else if (it.previewUrl) {
                          window.open(resolveUrl(it.previewUrl), "_blank", "noopener,noreferrer");
                        }
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
                      <div className="text-sm font-medium">
                        {it.kind === "post" ? "Пост" : it.kind === "story" ? "Сториз" : "Файл"}
                      </div>
                      {it.kind === "media" ? (
                        <div className="text-[11px] text-muted-foreground">Загружено с устройства</div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          👁 {it.viewsCount} · ❤️ {it.likesCount}
                        </div>
                      )}
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
            <label className="text-xs text-muted-foreground">
              Описание (до 500 символов; на профиле удерживайте папку — всплывёт подсказка)
            </label>
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
                accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
                className="text-sm"
                disabled={coverBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  void handleCoverFilePick(f);
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

      <PostVideoTrimmerModal
        open={folderMediaTrimOpen}
        file={folderMediaVideoFile}
        maxSegmentSeconds={POST_VIDEO_MAX_SECONDS}
        title="Фрагмент для папки"
        description={`До ${POST_VIDEO_MAX_SECONDS} сек. Видео будет перекодировано как для поста.`}
        onOpenChange={(o) => {
          setFolderMediaTrimOpen(o);
          if (!o) setFolderMediaVideoFile(null);
        }}
        onConfirm={(trim) => void onFolderMediaTrimConfirm(trim)}
      />
      <PostVideoTrimmerModal
        open={coverTrimOpen}
        file={coverVideoFile}
        maxSegmentSeconds={POST_VIDEO_MAX_SECONDS}
        title="Обложка папки"
        description={`Выберите фрагмент до ${POST_VIDEO_MAX_SECONDS} сек.`}
        onOpenChange={(o) => {
          setCoverTrimOpen(o);
          if (!o) setCoverVideoFile(null);
        }}
        onConfirm={(trim) => void onCoverTrimConfirm(trim)}
      />

      <UploadProgressBlockingOverlay
        open={coverBusy || folderMediaBusy}
        title={coverBusy ? "Загрузка обложки" : "Добавление файла"}
        percent={pinUploadPercent}
        footnote={pinUploadPercent != null ? "Отправка на сервер…" : null}
        zIndexClass="z-[500]"
        ariaLabel={coverBusy ? "Загрузка обложки папки" : "Загрузка файла в папку"}
      />
    </div>
  );
}
