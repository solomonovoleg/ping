import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { UploadProgressTrack } from "@/components/ui/upload-progress-panel";
import { useToast } from "@/hooks/use-toast";
import { resolveUrl } from "@/lib/api-base";
import { createStickerPackWithFiles, STICKER_FILES_MAX_PER_UPLOAD, type StickerPackVisibility } from "@/lib/stickers";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { isStickerImageFile, STICKER_FILE_INPUT_ACCEPT } from "./sticker-image-utils";
import { StickerPendingThumb } from "./StickerPendingThumb";

type PendingStickerFile = { id: string; file: File; previewUrl: string };

type StickerPackCreateFormProps = {
  /** Вызывается после успешного создания (закрыть диалог, обновить список и т.д.) */
  onSuccess?: () => void;
  /** Сбросить поля при смене ключа (например dialog closed) */
  formKey?: string | number;
  className?: string;
  /** Вариант оформления кнопки загрузки */
  submitVariant?: "default" | "prominent";
};

function makePendingItems(files: File[]): PendingStickerFile[] {
  const imageFiles = files.filter(isStickerImageFile);
  return imageFiles.map((file, i) => ({
    id: `${Date.now()}-${i}-${file.name}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

export function StickerPackCreateForm({
  onSuccess,
  formKey,
  className,
  submitVariant = "default",
}: StickerPackCreateFormProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<PendingStickerFile[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newVisibility, setNewVisibility] = useState<StickerPackVisibility>("private");
  const [createProgress, setCreateProgress] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<PendingStickerFile[]>([]);
  /** Превью уже загруженных на сервер (WebP), чтобы было видно результат. */
  const [uploadedPreviewUrls, setUploadedPreviewUrls] = useState<string[] | null>(null);

  pendingRef.current = pendingItems;

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((x) => URL.revokeObjectURL(x.previewUrl));
    };
  }, []);

  const clearPending = useCallback(() => {
    setPendingItems((prev) => {
      prev.forEach((x) => URL.revokeObjectURL(x.previewUrl));
      return [];
    });
  }, []);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["sticker-packs", "mine"] });
  }, [qc]);

  const createMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const title = newTitle.trim();
      if (!title) throw new Error("Введите название набора");
      if (!files.length) throw new Error("Добавьте хотя бы одно изображение");
      setCreateProgress(null);
      return createStickerPackWithFiles(title, newVisibility, files, {
        onProgress: (p) => setCreateProgress(p),
      });
    },
    onSuccess: (data) => {
      setNewTitle("");
      setCreateProgress(null);
      clearPending();
      const urls = data.pack.stickers.map((s) => resolveUrl(s.imageUrl)).filter(Boolean);
      // В диалоге чата форма сразу закрывается — превью не успеют увидеть; на странице настроек показываем.
      if (submitVariant === "default" && urls.length) {
        setUploadedPreviewUrls(urls);
        window.setTimeout(() => setUploadedPreviewUrls(null), 14_000);
      } else {
        setUploadedPreviewUrls(null);
      }
      invalidate();
      toast({
        title: "Набор создан",
        description: "В чате: смайлики → стикеры. Форматы JPEG/PNG/HEIC конвертируются в WebP на сервере.",
      });
      onSuccess?.();
    },
    onError: (e: Error) => {
      setCreateProgress(null);
      toast({ title: e.message || "Не удалось создать набор", variant: "destructive" });
    },
  });

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;
    let next = makePendingItems(Array.from(list));
    if (next.length === 0) {
      toast({
        title: "Нет подходящих файлов",
        description: "Нужны JPEG, PNG, WebP, GIF или HEIC/HEIF (фото с iPhone).",
        variant: "destructive",
      });
      return;
    }
    if (next.length > STICKER_FILES_MAX_PER_UPLOAD) {
      toast({
        title: `Не больше ${STICKER_FILES_MAX_PER_UPLOAD} файлов за раз`,
        description: "Добавлены только первые из выбранных.",
      });
      next = next.slice(0, STICKER_FILES_MAX_PER_UPLOAD);
    }
    setPendingItems((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > STICKER_FILES_MAX_PER_UPLOAD) {
        const drop = merged.slice(STICKER_FILES_MAX_PER_UPLOAD);
        drop.forEach((x) => URL.revokeObjectURL(x.previewUrl));
        return merged.slice(0, STICKER_FILES_MAX_PER_UPLOAD);
      }
      return merged;
    });
    if (next.length > 0 && submitVariant === "prominent") {
      toast({
        title: next.length === 1 ? "Файл добавлен — превью ниже" : `Добавлено файлов: ${next.length}`,
      });
    }
  };

  const removePendingAt = (id: string) => {
    setPendingItems((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t) URL.revokeObjectURL(t.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  };

  const handleSubmit = () => {
    const title = newTitle.trim();
    if (!title) {
      toast({ title: "Введите название набора", variant: "destructive" });
      return;
    }
    if (!pendingItems.length) {
      toast({ title: "Сначала выберите изображения", variant: "destructive" });
      return;
    }
    setUploadedPreviewUrls(null);
    createMutation.mutate(pendingItems.map((x) => x.file));
  };

  const pickId = useId();
  const inputId = `st-create-files-${formKey ?? "default"}-${pickId}`;
  const canCreate = newTitle.trim().length > 0 && pendingItems.length > 0 && !createMutation.isPending;
  const titleFieldId = `st-pack-title-${formKey ?? "x"}-${pickId}`;

  return (
    <div className={cn("space-y-4", className)} key={formKey}>
      <div className="space-y-1.5">
        <Label htmlFor={titleFieldId}>Название набора</Label>
        <Input
          id={titleFieldId}
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Например, «Мой кот»"
          maxLength={64}
          autoComplete="off"
          disabled={createMutation.isPending}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-muted-foreground">Кто видит набор</Label>
        <RadioGroup
          value={newVisibility}
          onValueChange={(v) => setNewVisibility(v as StickerPackVisibility)}
          className="flex flex-col gap-2"
          disabled={createMutation.isPending}
        >
          <label className="flex min-h-[var(--uix-touch-min)] cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="private" id={`st-vis-pr-${formKey ?? "x"}-${pickId}`} />
            <span>Только я</span>
          </label>
          <label className="flex min-h-[var(--uix-touch-min)] cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="public" id={`st-vis-pu-${formKey ?? "x"}-${pickId}`} />
            <span>Публичный — смогут найти в поиске ниже</span>
          </label>
        </RadioGroup>
      </div>

      <div
        className={cn(
          "rounded-xl border border-border/60 bg-muted/25 p-4",
          submitVariant === "prominent" && "border-primary/25 bg-primary/5",
        )}
      >
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          JPEG, PNG, WebP, GIF и фото с iPhone (HEIC). 1) Выберите файлы и проверьте превью. 2) «Создать набор» —
          загрузка и конвертация в WebP (до 512 px) на сервере.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept={STICKER_FILE_INPUT_ACCEPT}
          multiple
          className="sr-only"
          id={inputId}
          disabled={createMutation.isPending}
          onChange={onPickFiles}
        />

        {submitVariant === "prominent" ? (
          <TapScaleButton
            type="button"
            haptic
            className="flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/80 px-4 py-3 text-sm font-medium shadow-sm hover:bg-background disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              triggerLightHaptic();
              fileInputRef.current?.click();
            }}
            disabled={createMutation.isPending}
          >
            <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
            Выбрать изображения
            {pendingItems.length > 0 ? (
              <span className="tabular-nums text-muted-foreground">({pendingItems.length})</span>
            ) : null}
          </TapScaleButton>
        ) : (
          <Button type="button" variant="secondary" disabled={createMutation.isPending} asChild>
            <label htmlFor={inputId} className="min-h-[var(--uix-touch-min)] cursor-pointer">
              <span className="inline-flex items-center gap-2">
                <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
                Выбрать изображения
                {pendingItems.length > 0 ? (
                  <span className="tabular-nums text-muted-foreground">({pendingItems.length})</span>
                ) : null}
              </span>
            </label>
          </Button>
        )}

        {pendingItems.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">Превью</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {pendingItems.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-lg border border-border/50 bg-secondary/30 p-0.5">
                  <StickerPendingThumb
                    previewUrl={item.previewUrl}
                    fileName={item.file.name}
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    disabled={createMutation.isPending}
                    className="absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-foreground shadow-sm ring-1 ring-border/60 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] sm:min-h-7 sm:min-w-7"
                    aria-label="Убрать из списка"
                    onClick={() => removePendingAt(item.id)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {createMutation.isPending ? (
          <div className="mt-4 space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5" aria-live="polite">
            <p className="text-[11px] font-medium text-foreground">
              {createProgress != null ? `Отправка файлов: ${createProgress}%` : "Отправка на сервер…"}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Если процент не меняется — так бывает в Safari; дождитесь окончания. После ответа покажем результат.
            </p>
            <UploadProgressTrack percent={createProgress} />
          </div>
        ) : null}

        {uploadedPreviewUrls && uploadedPreviewUrls.length > 0 ? (
          <div className="mt-4 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2.5">
            <p className="mb-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Готово на сервере (WebP)</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {uploadedPreviewUrls.map((src) => (
                <div key={src} className="aspect-square rounded-lg border border-border/40 bg-background/80 p-0.5">
                  <img src={src} alt="" className="h-full w-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {submitVariant === "prominent" ? (
          <TapScaleButton
            type="button"
            haptic
            className="mt-4 flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              triggerLightHaptic();
              handleSubmit();
            }}
            disabled={!canCreate}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                {createProgress != null ? `Загрузка ${createProgress}%` : "Загрузка…"}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Создать набор
              </>
            )}
          </TapScaleButton>
        ) : (
          <Button
            type="button"
            className="mt-4 min-h-[var(--uix-touch-min)] w-full"
            disabled={!canCreate}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                {createProgress != null ? `Загрузка ${createProgress}%` : "Загрузка…"}
              </span>
            ) : (
              "Создать набор"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
