import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadProgressTrack } from "@/components/ui/upload-progress-panel";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { resolveUrl } from "@/lib/api-base";
import {
  addStickersToPack,
  deleteSticker,
  deleteStickerPack,
  patchStickerPack,
  STICKER_FILES_MAX_PER_UPLOAD,
  type StickerPackVisibility,
} from "@/lib/stickers";
import { isStickerImageFile, STICKER_FILE_INPUT_ACCEPT } from "./sticker-image-utils";
import { StickerPendingThumb } from "./StickerPendingThumb";

export type StickerPackSettingsCardPack = {
  id: string;
  title: string;
  visibility: string;
  stickers: { id: string; imageUrl: string; sortOrder: number }[];
};

type PendingAdd = { id: string; file: File; previewUrl: string };

function makePendingAdds(files: File[]): PendingAdd[] {
  return files
    .filter(isStickerImageFile)
    .map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
}

export function StickerPackSettingsCard({
  pack,
  onChanged,
}: {
  pack: StickerPackSettingsCardPack;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const addInputId = useId();
  const pendingRef = useRef<PendingAdd[]>([]);
  const [busy, setBusy] = useState(false);
  const [addingStickers, setAddingStickers] = useState(false);
  const [addProgress, setAddProgress] = useState<number | null>(null);
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [justAddedUrls, setJustAddedUrls] = useState<string[] | null>(null);

  pendingRef.current = pendingAdds;

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((x) => URL.revokeObjectURL(x.previewUrl));
    };
  }, []);

  const clearPendingAdds = useCallback(() => {
    setPendingAdds((prev) => {
      prev.forEach((x) => URL.revokeObjectURL(x.previewUrl));
      return [];
    });
  }, []);

  const setVisibility = async (vis: StickerPackVisibility) => {
    setBusy(true);
    try {
      await patchStickerPack(pack.id, { visibility: vis });
      onChanged();
      toast({ title: "Сохранено" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onDeletePack = async () => {
    if (!window.confirm(`Удалить набор «${pack.title}» и все стикеры?`)) return;
    setBusy(true);
    try {
      await deleteStickerPack(pack.id);
      onChanged();
      toast({ title: "Набор удалён" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onRemoveSticker = async (stickerId: string) => {
    setBusy(true);
    try {
      await deleteSticker(stickerId);
      onChanged();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onPickAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;
    let next = makePendingAdds(Array.from(list));
    if (next.length === 0) {
      toast({
        title: "Нет подходящих файлов",
        description: "JPEG, PNG, WebP, GIF или HEIC/HEIF (iPhone).",
        variant: "destructive",
      });
      return;
    }
    if (next.length > STICKER_FILES_MAX_PER_UPLOAD) {
      toast({
        title: `Не больше ${STICKER_FILES_MAX_PER_UPLOAD} файлов за раз`,
        description: "Добавлены только первые.",
      });
      next = next.slice(0, STICKER_FILES_MAX_PER_UPLOAD);
    }
    setPendingAdds((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > STICKER_FILES_MAX_PER_UPLOAD) {
        const drop = merged.slice(STICKER_FILES_MAX_PER_UPLOAD);
        drop.forEach((x) => URL.revokeObjectURL(x.previewUrl));
        return merged.slice(0, STICKER_FILES_MAX_PER_UPLOAD);
      }
      return merged;
    });
  };

  const removePendingAdd = (id: string) => {
    setPendingAdds((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const onConfirmAddStickers = async () => {
    if (!pendingAdds.length) {
      toast({ title: "Сначала выберите файлы", variant: "destructive" });
      return;
    }
    setBusy(true);
    setAddingStickers(true);
    setAddProgress(null);
    setJustAddedUrls(null);
    try {
      const result = await addStickersToPack(
        pack.id,
        pendingAdds.map((x) => x.file),
        { onProgress: (p) => setAddProgress(p) },
      );
      clearPendingAdds();
      const urls = result.stickers.map((s) => resolveUrl(s.imageUrl)).filter(Boolean);
      if (urls.length) {
        setJustAddedUrls(urls);
        window.setTimeout(() => setJustAddedUrls(null), 14_000);
      }
      onChanged();
      toast({ title: "Стикеры добавлены", description: "Ниже — превью с сервера (WebP)." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Не удалось добавить", variant: "destructive" });
    } finally {
      setAddingStickers(false);
      setBusy(false);
      setAddProgress(null);
    }
  };

  const fileInputDomId = `st-add-${pack.id}-${addInputId}`;
  const canUploadAdds = pendingAdds.length > 0 && !busy;

  return (
    <li className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{pack.title}</p>
          <p className="text-xs text-muted-foreground">
            {pack.visibility === "public" ? "Публичный" : "Только вы"} · {pack.stickers.length}{" "}
            {pack.stickers.length === 1 ? "стикер" : pack.stickers.length < 5 ? "стикера" : "стикеров"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pack.visibility === "private" ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void setVisibility("public")}>
              Сделать публичным
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void setVisibility("private")}>
              Только для себя
            </Button>
          )}
          <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void onDeletePack()}>
            Удалить набор
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
          JPEG, PNG, WebP, GIF, HEIC (iPhone). Выберите файлы → превью → «Добавить в набор».
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept={STICKER_FILE_INPUT_ACCEPT}
            multiple
            className="sr-only"
            id={fileInputDomId}
            disabled={busy}
            onChange={onPickAddFiles}
          />
          <Button type="button" size="sm" variant="secondary" disabled={busy} asChild>
            <label htmlFor={fileInputDomId} className="min-h-[var(--uix-touch-min)] cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                Выбрать изображения
                {pendingAdds.length > 0 ? (
                  <span className="tabular-nums text-muted-foreground">({pendingAdds.length})</span>
                ) : null}
              </span>
            </label>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canUploadAdds}
            onClick={() => void onConfirmAddStickers()}
            className="min-h-[var(--uix-touch-min)]"
          >
            {addingStickers && addProgress != null ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                {addProgress}%
              </span>
            ) : addingStickers ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Загрузка…
              </span>
            ) : (
              `Добавить в набор${pendingAdds.length ? ` (${pendingAdds.length})` : ""}`
            )}
          </Button>
        </div>
        {addingStickers ? (
          <div className="mt-3 space-y-2 rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2" aria-live="polite">
            <p className="text-[11px] font-medium text-foreground">
              {addProgress != null ? `Отправка: ${addProgress}%` : "Отправка на сервер…"}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              В Safari процент иногда не бегает — это нормально, ждите завершения.
            </p>
            <UploadProgressTrack percent={addProgress} />
          </div>
        ) : null}
        {justAddedUrls && justAddedUrls.length > 0 ? (
          <div className="mt-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-2">
            <p className="mb-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Загружено (WebP на сервере)</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {justAddedUrls.map((src) => (
                <div key={src} className="aspect-square rounded-lg border border-border/40 bg-background/80 p-0.5">
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {pendingAdds.length > 0 ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {pendingAdds.map((item) => (
              <div key={item.id} className="relative aspect-square rounded-lg border border-dashed border-primary/35 bg-background/50 p-0.5">
                <StickerPendingThumb
                  previewUrl={item.previewUrl}
                  fileName={item.file.name}
                  className="h-full w-full object-contain"
                />
                <button
                  type="button"
                  disabled={busy}
                  className="absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/95 shadow-sm ring-1 ring-border/60"
                  aria-label="Убрать из списка"
                  onClick={() => removePendingAdd(item.id)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
        {pack.stickers.map((s) => (
          <div key={s.id} className="relative aspect-square rounded-lg bg-secondary/40 p-0.5">
            <img src={resolveUrl(s.imageUrl)} alt="" className="h-full w-full object-contain" loading="lazy" />
            <TapScaleButton
              type="button"
              haptic
              disabled={busy}
              className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm"
              aria-label="Удалить стикер"
              onClick={() => void onRemoveSticker(s.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TapScaleButton>
          </div>
        ))}
      </div>
    </li>
  );
}
