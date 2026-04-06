import { useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { uploadPostMedia, uploadPostMediaImageResized } from "@/lib/posts";
import { cn } from "@/lib/utils";
import type { EdgeMoneyColorScheme } from "@/lib/edge-money-public";
import {
  EMONEY_COLOR_PRESETS,
  EMONEY_SCHEME_KEYS,
} from "@/features/edge-money-template/emoney-color-presets";

type Props = {
  headline: string;
  mediaUrl: string;
  colorScheme: EdgeMoneyColorScheme;
  onHeadline: (v: string) => void;
  onMediaUrl: (v: string) => void;
  onColorScheme: (v: EdgeMoneyColorScheme) => void;
};

function looksLikeVideo(name: string, type: string): boolean {
  return type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(name);
}

export function MoneyStepPresentation({ headline, mediaUrl, colorScheme, onHeadline, onMediaUrl, onColorScheme }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|hei[cf])$/i.test(file.name);
    const isVideo = looksLikeVideo(file.name, file.type);
    if (!isImage && !isVideo) {
      toast({ title: "Поддерживаются изображения и видео", variant: "destructive" });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      const url = isVideo ? await uploadPostMedia(file) : await uploadPostMediaImageResized(file);
      onMediaUrl(url);
      toast({ title: "Медиа загружено" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Загрузка не удалась", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasMedia = mediaUrl.trim().length > 0;
  const isMediaVideo = hasMedia && /\.(mp4|mov|webm|avi|mkv)(\?|$)/i.test(mediaUrl);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2.5 uix-text-caption text-foreground">
        <span className="font-medium">Коротко:</span> здесь то, что люди увидят на карточке игры — заголовок и
        опционально картинка или видео.
      </div>
      <div>
        <Label htmlFor="money-headline">Заголовок для игроков</Label>
        <Input
          id="money-headline"
          value={headline}
          onChange={(e) => onHeadline(e.target.value)}
          placeholder="Например: Розыгрыш 10 000 ₽"
          className="mt-1.5"
          maxLength={500}
        />
        <p className="mt-1 uix-text-caption text-muted-foreground">1 строка в карточке — без длинных правил.</p>
      </div>

      <div>
        <Label>Фото или видео (необязательно)</Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <TapScaleButton
            type="button"
            subtle
            haptic
            disabled={uploading}
            className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-2 rounded-xl border border-border px-3 py-2 uix-text-caption"
            aria-label="Загрузить медиа с устройства"
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {uploading ? "Загрузка…" : "Загрузить с устройства"}
          </TapScaleButton>
          {hasMedia ? (
            <TapScaleButton
              type="button"
              subtle
              haptic
              disabled={uploading}
              className="inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-xl px-2 py-2 uix-text-caption text-destructive"
              aria-label="Убрать медиа"
              onClick={() => onMediaUrl("")}
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Убрать
            </TapScaleButton>
          ) : null}
        </div>

        {hasMedia ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-border/60">
            {isMediaVideo ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                className="max-h-48 w-full object-contain bg-black"
              />
            ) : (
              <img
                src={mediaUrl}
                alt="Предпросмотр"
                className="max-h-48 w-full object-contain bg-black/5 dark:bg-white/5"
              />
            )}
          </div>
        ) : null}
      </div>

      <div>
        <Label htmlFor="money-media">Или вставьте ссылку</Label>
        <Input
          id="money-media"
          value={mediaUrl}
          onChange={(e) => onMediaUrl(e.target.value)}
          placeholder="https://…"
          className="mt-1.5"
          maxLength={2048}
          disabled={uploading}
        />
      </div>

      <div>
        <Label>Цветовая схема</Label>
        <p className="mt-0.5 uix-text-caption text-muted-foreground">Акцентный цвет в карточке игры</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {EMONEY_SCHEME_KEYS.map((key) => {
            const preset = EMONEY_COLOR_PRESETS[key];
            const active = key === colorScheme;
            return (
              <TapScaleButton
                key={key}
                type="button"
                haptic
                subtle
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2 min-w-[56px]",
                  active && "bg-secondary ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                onClick={() => onColorScheme(key)}
                aria-label={`Схема «${preset.label}»`}
                aria-pressed={active}
              >
                <div
                  className="relative h-8 w-8 rounded-full border-2"
                  style={{
                    backgroundColor: preset.preview,
                    borderColor: active ? preset.preview : "var(--border)",
                  }}
                >
                  {active ? (
                    <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-sm" />
                  ) : null}
                </div>
                <span className={cn("text-[11px] font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                  {preset.label}
                </span>
              </TapScaleButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}
