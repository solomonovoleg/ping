import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ImagePlus, Loader2, Mail, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostMedia } from "@/components/PostMedia";
import { useToast } from "@/hooks/use-toast";
import { fetchSenderWelcome, patchSenderWelcome } from "@/lib/sender";
import { uploadPostMedia } from "@/lib/posts";
import { compressImage } from "@/lib/compress-image";
import { cn } from "@/lib/utils";

export default function BoardSender() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["sender", "welcome"],
    queryFn: fetchSenderWelcome,
  });

  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data) return;
    setModuleEnabled(data.moduleEnabled);
    setAutoSend(data.autoSendOnFollow);
    setText(data.welcomeText);
    setMediaUrl(data.welcomeMediaUrl);
  }, [data]);

  const { mutate: persistMutate, isPending: savePending } = useMutation({
    mutationFn: patchSenderWelcome,
    onSuccess: (next) => {
      queryClient.setQueryData(["sender", "welcome"], next);
      setModuleEnabled(next.moduleEnabled);
      setAutoSend(next.autoSendOnFollow);
      setText(next.welcomeText);
      setMediaUrl(next.welcomeMediaUrl);
      toast({ title: "Сохранено" });
    },
    onError: (e: Error) => {
      toast({ title: e.message ?? "Ошибка", variant: "destructive" });
    },
  });

  const persist = useCallback(
    (patch: Parameters<typeof patchSenderWelcome>[0]) => {
      persistMutate({
        moduleEnabled: patch.moduleEnabled !== undefined ? patch.moduleEnabled : moduleEnabled,
        autoSendOnFollow: patch.autoSendOnFollow !== undefined ? patch.autoSendOnFollow : autoSend,
        welcomeText: patch.welcomeText !== undefined ? patch.welcomeText : text,
        welcomeMediaUrl: patch.welcomeMediaUrl !== undefined ? patch.welcomeMediaUrl : mediaUrl,
      });
    },
    [moduleEnabled, autoSend, text, mediaUrl, persistMutate],
  );

  const onMediaPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      toast({ title: "Выберите фото или видео", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const file = f.type.startsWith("image/") ? await compressImage(f) : f;
      const url = await uploadPostMedia(file);
      setMediaUrl(url);
      toast({ title: "Файл загружен — нажмите «Сохранить»" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Не удалось загрузить", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const previewUrls = (() => {
    const u = mediaUrl?.trim();
    return u ? [u] : [];
  })();

  return (
    <div className="flex h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-secondary/30">
      <div className="w-full max-w-full min-w-0 h-full flex flex-col bg-background overflow-y-auto overflow-x-hidden pb-[calc(var(--uix-nav-bottom)+var(--uix-space-2))]">
        <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => setLocation("/board")}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="uix-text-title truncate">SENDER</h1>
              <p className="text-xs text-muted-foreground truncate">Приветствие новым подписчикам</p>
            </div>
          </div>
        </div>

        <div className="uix-content-x flex flex-col gap-6 pb-8">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          )}

          {isError && (
            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Ошибка загрузки"}</p>
              <Button type="button" variant="secondary" className="min-h-[var(--uix-touch-min)]" onClick={() => void refetch()}>
                Повторить
              </Button>
            </div>
          )}

          {!isLoading && !isError && data && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                  <p className="text-2xl font-semibold tabular-nums">{data.stats.followersCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">подписчиков</p>
                </div>
                <div className="rounded-2xl border border-border/50 bg-card/60 p-4">
                  <p className="text-2xl font-semibold tabular-nums">{data.stats.welcomesDeliveredCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">получили приветствие</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Label htmlFor="sender-module" className="text-sm font-medium">
                      Подключить SENDER
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Модуль в Борде и настройки приветствия</p>
                  </div>
                  <Switch
                    id="sender-module"
                    checked={moduleEnabled}
                    disabled={savePending}
                    onCheckedChange={(v) => {
                      setModuleEnabled(v);
                      if (!v) setAutoSend(false);
                      persist({ moduleEnabled: v, autoSendOnFollow: v ? autoSend : false });
                    }}
                  />
                </div>

                {moduleEnabled && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
                    <div className="min-w-0">
                      <Label htmlFor="sender-auto" className="text-sm font-medium">
                        Автоотправка при подписке
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">ЛС от вашего имени сразу после подписки</p>
                    </div>
                    <Switch
                      id="sender-auto"
                      checked={autoSend}
                      disabled={savePending}
                      onCheckedChange={(v) => {
                        setAutoSend(v);
                        persist({ autoSendOnFollow: v });
                      }}
                    />
                  </div>
                )}
              </div>

              {moduleEnabled && (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-4">
                  <div>
                    <Label htmlFor="sender-text" className="text-sm font-medium">
                      Текст приветствия
                    </Label>
                    <textarea
                      id="sender-text"
                      className={cn(
                        "mt-2 w-full min-h-[120px] rounded-xl border border-input bg-background px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      )}
                      placeholder="Например: спасибо за подписку — вот ссылка на канал…"
                      value={text}
                      maxLength={4096}
                      onChange={(e) => setText(e.target.value.slice(0, 4096))}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">{text.length} / 4096</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Фото или видео (необязательно)</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex">
                        <input type="file" accept="image/*,video/*" className="sr-only" onChange={(e) => void onMediaPick(e)} disabled={uploading || savePending} />
                        <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm min-h-[var(--uix-touch-min)] cursor-pointer hover:bg-secondary/60">
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                          Загрузить
                        </span>
                      </label>
                      {mediaUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-[var(--uix-touch-min)] text-destructive"
                          onClick={() => setMediaUrl(null)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Убрать медиа
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full min-h-[var(--uix-touch-min)]"
                    disabled={savePending || uploading || (autoSend && !text.trim() && !mediaUrl?.trim())}
                    onClick={() => persist({})}
                  >
                    {savePending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Сохранить приветствие
                  </Button>
                  {autoSend && !text.trim() && !mediaUrl?.trim() && (
                    <p className="text-xs text-destructive">Для автоотправки нужен текст или медиа — сохраните сообщение.</p>
                  )}
                </div>
              )}

              {moduleEnabled && (text.trim() || mediaUrl?.trim()) && (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-4 space-y-2">
                  <p className="text-sm font-medium">Предпросмотр</p>
                  <p className="text-sm whitespace-pre-wrap text-foreground/90">{text.trim() || "—"}</p>
                  {previewUrls.length > 0 ? <PostMedia mediaUrls={previewUrls} className="!mt-2" /> : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
