import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2, Sparkles, Video, X } from "lucide-react";
import type { PushTtlValue } from "@shared/schema/push-feed";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/compress-image";
import { createPost, uploadPostMedia } from "@/lib/posts";
import { fetchMyPushQuota } from "@/lib/push-feed";
import { cn } from "@/lib/utils";
import { PUSH_FORM_TTL_OPTIONS, STANDALONE_PUSH_TEXT_MAX_LENGTH } from "./constants";
import { describePushAudience } from "./push-audience-copy";
import { trackPushUix } from "./push-analytics";
import { getPushTtlComposerHint } from "./push-ttl-hint-copy";

type CreateStandalonePushDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TTL_ROW1 = PUSH_FORM_TTL_OPTIONS.slice(0, 3);
const TTL_ROW2 = PUSH_FORM_TTL_OPTIONS.slice(3);

export function CreateStandalonePushDrawer({ open, onOpenChange }: CreateStandalonePushDrawerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"image" | "video" | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [pushTtl, setPushTtl] = useState<PushTtlValue>("24h");

  const { data: quota } = useQuery({
    queryKey: ["push", "quota"],
    queryFn: fetchMyPushQuota,
    enabled: open,
    staleTime: 10_000,
  });

  const resetForm = useCallback(() => {
    setText("");
    setMediaUrl(null);
    setMediaKind(null);
    setUploadPct(null);
    setPushTtl("24h");
  }, []);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (!trimmed && !mediaUrl) {
        throw new Error("Добавьте текст или фото/видео");
      }
      return createPost({
        text: trimmed,
        ...(mediaUrl ? { mediaUrls: [mediaUrl] } : {}),
        sendToPush: true,
        pushTtl,
        linkEmbedEnabled: true,
        showOnAuthorWall: false,
      });
    },
    onSuccess: () => {
      resetForm();
      onOpenChange(false);
      void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "outbox"] });
      void queryClient.invalidateQueries({ queryKey: ["push", "quota"] });
      if (user?.id) {
        void queryClient.invalidateQueries({ queryKey: ["posts", "author", user.id] });
        void queryClient.invalidateQueries({ queryKey: ["profile", "me"] });
      }
      trackPushUix("standalone_push_sent");
      toast({ title: "Push отправлен подписчикам" });
    },
    onError: (e) => {
      toast({
        title: e instanceof Error ? e.message : "Не удалось отправить Push",
        variant: "destructive",
      });
    },
  });

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast({ title: "Выберите изображение или видео", variant: "destructive" });
      return;
    }
    setUploadPct(0);
    try {
      const toUpload = isImage ? await compressImage(file) : file;
      const url = await uploadPostMedia(toUpload, undefined, {
        onProgress: (p) => setUploadPct(p),
      });
      setMediaUrl(url);
      setMediaKind(isVideo ? "video" : "image");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Не удалось загрузить файл", variant: "destructive" });
    } finally {
      setUploadPct(null);
    }
  };

  const remaining = quota?.remaining ?? 0;
  const maxDay = quota?.maxPerDay ?? 3;
  const inFeed = quota?.subscribersInFeed ?? 0;
  const notify = quota?.notifyRecipients ?? 0;
  const canSubmit = (text.trim().length > 0 || Boolean(mediaUrl)) && remaining > 0 && !submitMutation.isPending && uploadPct == null;

  const audienceLine = describePushAudience(inFeed, notify).long;

  const scrollComposerFieldIntoView = useCallback(() => {
    const ta = textareaRef.current;
    const sc = bodyScrollRef.current;
    if (!ta || !sc) return;
    const pad = 10;
    const scRect = sc.getBoundingClientRect();
    const taRect = ta.getBoundingClientRect();
    if (taRect.top < scRect.top + pad) {
      sc.scrollTop += taRect.top - scRect.top - pad;
    } else if (taRect.bottom > scRect.bottom - pad) {
      sc.scrollTop += taRect.bottom - scRect.bottom + pad;
    }
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !open) return;
    const onFocus = () => {
      requestAnimationFrame(() => scrollComposerFieldIntoView());
    };
    ta.addEventListener("focus", onFocus);
    return () => ta.removeEventListener("focus", onFocus);
  }, [open, scrollComposerFieldIntoView]);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    const onVv = () => scrollComposerFieldIntoView();
    vv?.addEventListener("resize", onVv);
    vv?.addEventListener("scroll", onVv);
    return () => {
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
    };
  }, [open, scrollComposerFieldIntoView]);

  return (
    <Drawer
      open={open}
      repositionInputs={false}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DrawerContent className="flex max-h-[min(92dvh,720px)] flex-col rounded-t-[1.25rem] border-border/40 p-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="shrink-0 space-y-1 border-b border-border/30 pb-3 text-left">
          <DrawerTitle className="flex items-center gap-2 text-[1.05rem] font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400 text-white shadow-sm">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            Новый Push
          </DrawerTitle>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Не пост в ленте — только раздел <span className="font-medium text-foreground/80">Чаты → Push</span>. Лимит
            сегодня:{" "}
            <span className="tabular-nums font-medium text-foreground/90">
              {remaining}/{maxDay}
            </span>
            . {audienceLine}
          </p>
        </DrawerHeader>

        <div
          ref={bodyScrollRef}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3"
        >
          <div>
            <label htmlFor="standalone-push-text" className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              Текст
            </label>
            <textarea
              ref={textareaRef}
              id="standalone-push-text"
              value={text}
              onChange={(ev) => setText(ev.target.value.slice(0, STANDALONE_PUSH_TEXT_MAX_LENGTH))}
              rows={5}
              maxLength={STANDALONE_PUSH_TEXT_MAX_LENGTH}
              placeholder="Коротко подписчикам…"
              className="w-full resize-none rounded-xl border border-border/60 bg-background/90 p-3 text-[14px] leading-snug outline-none focus:ring-2 focus:ring-rose-400/35"
            />
            <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
              {text.length}/{STANDALONE_PUSH_TEXT_MAX_LENGTH}
            </p>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Медиа</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {!mediaUrl ? (
              <div className="flex flex-wrap items-center gap-2">
                <TapScaleButton
                  type="button"
                  subtle
                  onClick={handlePickFile}
                  disabled={uploadPct != null}
                  className="min-h-[var(--uix-touch-min)] rounded-xl border border-border/50 px-3 text-[13px]"
                >
                  {uploadPct != null ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  Фото или видео
                </TapScaleButton>
                <span className="flex items-center text-[11px] text-muted-foreground">
                  <Video className="mr-1 h-3.5 w-3.5 opacity-70" aria-hidden />
                  один файл
                </span>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-border/45 bg-muted/20">
                {mediaKind === "video" ? (
                  <video src={mediaUrl} className="max-h-48 w-full object-cover" muted playsInline controls preload="metadata" />
                ) : (
                  <img src={mediaUrl} alt="" className="max-h-48 w-full object-cover" />
                )}
                <TapScaleButton
                  type="button"
                  subtle
                  aria-label="Убрать медиа"
                  onClick={() => {
                    setMediaUrl(null);
                    setMediaKind(null);
                  }}
                  className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/90 shadow-sm"
                >
                  <X className="h-4 w-4" />
                </TapScaleButton>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Срок в ленте Push</p>
            <div className="grid grid-cols-3 gap-1.5">
              {TTL_ROW1.map((opt) => (
                <TapScaleButton
                  key={opt.value}
                  type="button"
                  subtle
                  onClick={() => setPushTtl(opt.value)}
                  className={cn(
                    "flex min-h-[36px] w-full items-center justify-center whitespace-nowrap rounded-full border px-1 text-[11px] font-semibold sm:text-[12px]",
                    pushTtl === opt.value
                      ? "border-rose-400/50 bg-rose-500/15 text-foreground"
                      : "border-border/50 text-muted-foreground",
                  )}
                >
                  {opt.label}
                </TapScaleButton>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {TTL_ROW2.map((opt) => (
                <TapScaleButton
                  key={opt.value}
                  type="button"
                  subtle
                  onClick={() => setPushTtl(opt.value)}
                  className={cn(
                    "flex min-h-[36px] w-full items-center justify-center whitespace-nowrap rounded-full border px-1 text-[11px] font-semibold sm:text-[12px]",
                    pushTtl === opt.value
                      ? "border-rose-400/50 bg-rose-500/15 text-foreground"
                      : "border-border/50 text-muted-foreground",
                  )}
                >
                  {opt.label}
                </TapScaleButton>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground/85">{getPushTtlComposerHint(pushTtl)}</p>
          </div>

          <TapScaleButton
            type="button"
            haptic
            disabled={!canSubmit}
            onClick={() => submitMutation.mutate()}
            className={cn(
              "mt-1 flex min-h-[48px] w-full shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-3 text-[15px] font-semibold text-white shadow-lg shadow-rose-500/20",
              "bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400",
              "disabled:opacity-45 disabled:shadow-none",
            )}
            aria-label="Отправить Push"
          >
            {submitMutation.isPending ? (
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                Отправка…
              </span>
            ) : (
              "Отправить"
            )}
          </TapScaleButton>
          {remaining <= 0 ? (
            <p className="text-center text-[12px] text-destructive/90">Дневной лимит Push исчерпан. Завтра снова.</p>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
