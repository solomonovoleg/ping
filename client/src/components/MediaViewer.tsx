/**
 * Просмотр медиа (фото/видео) внутри приложения.
 * Закрытие по клику вне или кнопке, зум, длинное нажатие 3 сек — сохранить/копировать.
 * UIX: анимации из lib/motion, reduced-motion, хаптик, подсказка.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { X, Download, Copy, ExternalLink } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-base";
import { isNative, triggerLightHaptic } from "@/lib/capacitor-native";
import { saveBlobToDevice } from "@/lib/save-media-blob";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useOfflineResolvedMediaUrl } from "@/hooks/useOfflineResolvedMediaUrl";
import {
  DURATION_NORMAL_MS,
  DURATION_NORMAL_S,
  DURATION_FAST_S,
  EASING_OUT,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";
import { useImmersiveDarkChrome } from "@/hooks/use-immersive-dark-chrome";

const LONG_PRESS_MS = 3000;
const HINT_FADE_MS = 2500;

type MediaViewerProps = {
  open: boolean;
  onClose: () => void;
  src: string;
  type: "image" | "video" | "video_note" | "pdf";
  /** Подпись в шапке (например имя файла для PDF) */
  title?: string;
};

function openUrlInExternalViewer(url: string): void {
  if (isNative()) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function safePdfDownloadName(raw: string, fallbackBase: string): string {
  const base = raw.trim().replace(/[/\\?*|":<>]/g, "_").slice(0, 180) || fallbackBase;
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}

export function MediaViewer({ open, onClose, src, type, title }: MediaViewerProps) {
  const offlineReadySrc = useOfflineResolvedMediaUrl(src, { autoCache: open });
  const validSrc = typeof offlineReadySrc === "string" && offlineReadySrc.trim().length > 0;
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [pdfFrameError, setPdfFrameError] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const reducedMotion = usePrefersReducedMotion();
  useImmersiveDarkChrome(open);

  const isImage = type === "image";
  const isPdf = type === "pdf";
  const isVideoNote = type === "video_note";

  useEffect(() => {
    if (!open) return;
    setLoadError(false);
    setPdfFrameError(false);
    setHintVisible(true);
    hintTimerRef.current = setTimeout(() => setHintVisible(false), HINT_FADE_MS);
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [open, type, src]);

  const handleClose = useCallback(() => {
    triggerLightHaptic();
    setScale(1);
    setShowActions(false);
    onClose();
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (showActions) setShowActions(false);
    else handleClose();
  };

  const handleDoubleClick = () => {
    if (!isImage) return;
    setScale((s) => (s >= 2 ? 1 : 2));
    triggerLightHaptic();
  };

  const longPress = useLongPress({
    durationMs: LONG_PRESS_MS,
    onLongPress: () => {
      setShowActions(true);
      triggerLightHaptic();
    },
  });

  const copyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(src);
      toast({ title: "Ссылка скопирована" });
      triggerLightHaptic();
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
    setShowActions(false);
  }, [src, toast]);

  const saveFile = useCallback(
    async (opts?: { closeActionsSheet?: boolean }) => {
      const closeSheet = opts?.closeActionsSheet !== false;
      setSaving(true);
      try {
        const res = await apiFetch(offlineReadySrc || src);
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        const ext = type === "image" ? "jpg" : type === "pdf" ? "pdf" : "mp4";
        const filename =
          type === "pdf"
            ? safePdfDownloadName(title ?? "", `document-${Date.now()}`)
            : `media-${Date.now()}.${ext}`;
        const galleryHint =
          type === "image" ? ("image" as const) : type === "video" || type === "video_note" ? ("video" as const) : null;
        await saveBlobToDevice(blob, { filename, galleryHint });
        toast({
          title: isNative() && galleryHint ? "Сохранено в галерею" : "Сохранено",
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        toast({ title: "Не удалось сохранить", variant: "destructive" });
      } finally {
        setSaving(false);
        if (closeSheet) setShowActions(false);
      }
    },
    [offlineReadySrc, src, type, title, toast]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const transition = reducedMotion ? { duration: 0 } : { duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER };

  const mediaErrorFallback = (reset: () => void) => (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 p-6">
      <p className="text-white/90 text-center mb-4">Не удалось открыть медиа</p>
      <button
        type="button"
        onClick={() => {
          reset();
          handleClose();
        }}
        className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-xl bg-white/20 text-white hover:bg-white/30"
      >
        Закрыть
      </button>
    </div>
  );

  const content = (
    <ErrorBoundary fallback={mediaErrorFallback}>
      <AnimatePresence>
        {open && validSrc && (
        <motion.div
          key="media-viewer"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.972 }}
          transition={transition}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal
          aria-label={isPdf ? "Просмотр PDF" : "Просмотр медиа"}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 pt-safe-offset-2 uix-fullscreen-overlay-x">
            {isPdf ? (
              <p className="min-w-0 flex-1 truncate pt-1.5 text-left text-sm font-medium text-white/90">
                {title?.trim() || "Документ.pdf"}
              </p>
            ) : (
              <span className="min-w-0 flex-1" aria-hidden />
            )}
            <div className="flex shrink-0 items-center gap-2">
              {isPdf && (
                <>
                  <TapScaleButton
                    type="button"
                    disabled={saving}
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerLightHaptic();
                      void saveFile({ closeActionsSheet: false });
                    }}
                    className="uix-overlay-icon-hit flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30 disabled:opacity-50"
                    aria-label="Скачать PDF"
                  >
                    <Download className="h-5 w-5" />
                  </TapScaleButton>
                  <TapScaleButton
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      triggerLightHaptic();
                      openUrlInExternalViewer(offlineReadySrc || src);
                    }}
                    className="uix-overlay-icon-hit flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                    aria-label="Открыть в браузере"
                  >
                    <ExternalLink className="h-5 w-5" />
                  </TapScaleButton>
                </>
              )}
              <TapScaleButton
                type="button"
                onClick={handleClose}
                className="uix-overlay-icon-hit flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </TapScaleButton>
            </div>
          </div>

          <AnimatePresence>
            {hintVisible && (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DURATION_FAST_S }}
                className="absolute top-20 left-4 right-4 z-10 text-center text-sm text-white/70"
              >
                {isPdf
                  ? "Скачать — иконка загрузки сверху справа. Удерживайте 3 сек — копировать ссылку"
                  : "Удерживайте 3 сек для сохранения"}
              </motion.p>
            )}
          </AnimatePresence>

          <div
            ref={containerRef}
            className="relative flex flex-1 max-h-[100vh] max-w-[100vw] items-center justify-center p-4 touch-manipulation"
            {...longPress}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
          >
            {loadError || (isPdf && pdfFrameError) ? (
              <div className="flex max-w-md flex-col items-center gap-4 px-4 text-center">
                <p className="text-white/80">
                  {isPdf ? "Не удалось показать PDF здесь" : "Не удалось загрузить медиа"}
                </p>
                {isPdf ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <TapScaleButton
                      type="button"
                      disabled={saving}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerLightHaptic();
                        void saveFile({ closeActionsSheet: false });
                      }}
                      className="min-h-[var(--uix-touch-min)] rounded-full bg-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/30 disabled:opacity-50"
                    >
                      {saving ? "Сохранение…" : "Скачать"}
                    </TapScaleButton>
                    <TapScaleButton
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerLightHaptic();
                        openUrlInExternalViewer(offlineReadySrc || src);
                      }}
                      className="min-h-[var(--uix-touch-min)] rounded-full bg-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/30"
                    >
                      Открыть в браузере
                    </TapScaleButton>
                  </div>
                ) : null}
              </div>
            ) : isPdf ? (
              <iframe
                src={offlineReadySrc}
                title={title?.trim() || "PDF"}
                className="h-[min(85vh,calc(100dvh-5.5rem))] w-full max-w-[min(100vw,56rem)] rounded-lg border border-white/15 bg-white shadow-lg"
                onClick={(e) => e.stopPropagation()}
                onError={() => setPdfFrameError(true)}
              />
            ) : isImage ? (
              <img
                src={offlineReadySrc}
                alt=""
                className="max-h-[90vh] max-w-full object-contain select-none"
                style={{
                  transform: `scale(${scale})`,
                  transition: `transform ${reducedMotion ? 0 : DURATION_FAST_S * 1000}ms ${EASING_OUT}`,
                }}
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                onError={() => setLoadError(true)}
              />
            ) : isVideoNote ? (
              <div className="relative h-[min(76vw,22rem)] w-[min(76vw,22rem)] overflow-hidden rounded-full border border-white/20 bg-black shadow-2xl">
                <video
                  src={offlineReadySrc}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                  onClick={(e) => e.stopPropagation()}
                  onError={() => setLoadError(true)}
                />
              </div>
            ) : (
              <video
                src={offlineReadySrc}
                controls
                playsInline
                className="max-h-[90vh] max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
                onError={() => setLoadError(true)}
              />
            )}
          </div>

          <AnimatePresence>
            {showActions && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={transition}
                className="absolute inset-x-0 bottom-0 flex justify-center gap-4 bg-black/70 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px)+1rem)] backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <TapScaleButton
                  type="button"
                  onClick={() => void saveFile()}
                  disabled={saving}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-6 py-3 text-white",
                    saving ? "bg-white/30" : "bg-white/20 hover:bg-white/30"
                  )}
                >
                  <Download className="h-5 w-5" />
                  <span>{saving ? "Сохранение…" : "Сохранить"}</span>
                </TapScaleButton>
                <TapScaleButton
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-2 rounded-full bg-white/20 px-6 py-3 text-white hover:bg-white/30"
                >
                  <Copy className="h-5 w-5" />
                  <span>Копировать ссылку</span>
                </TapScaleButton>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );

  return createPortal(content, document.body);
}
