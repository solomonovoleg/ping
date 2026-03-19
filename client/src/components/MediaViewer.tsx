/**
 * Просмотр медиа (фото/видео) внутри приложения.
 * Закрытие по клику вне или кнопке, зум, длинное нажатие 3 сек — сохранить/копировать.
 * UIX: анимации из lib/motion, reduced-motion, хаптик, подсказка.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useLongPress } from "@/hooks/useLongPress";
import { motion, AnimatePresence } from "framer-motion";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { X, Download, Copy } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-base";
import { isNative, saveMediaToGallery, triggerLightHaptic } from "@/lib/capacitor-native";
import { useToast } from "@/hooks/use-toast";
import { TapScaleButton } from "@/components/ui/tap-scale";
import {
  DURATION_NORMAL_MS,
  DURATION_NORMAL_S,
  DURATION_FAST_S,
  EASING_OUT,
  EASING_OUT_BEZIER,
  usePrefersReducedMotion,
} from "@/lib/motion";

const LONG_PRESS_MS = 3000;
const HINT_FADE_MS = 2500;

type MediaViewerProps = {
  open: boolean;
  onClose: () => void;
  src: string;
  type: "image" | "video" | "video_note";
};

export function MediaViewer({ open, onClose, src, type }: MediaViewerProps) {
  const validSrc = typeof src === "string" && src.trim().length > 0;
  const [scale, setScale] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const reducedMotion = usePrefersReducedMotion();

  const isImage = type === "image";

  useEffect(() => {
    if (!open) return;
    setLoadError(false);
    setHintVisible(true);
    hintTimerRef.current = setTimeout(() => setHintVisible(false), HINT_FADE_MS);
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [open]);

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

  const saveFile = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiFetch(src);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const ext = type === "image" ? "jpg" : type === "video_note" ? "mp4" : "mp4";
      const filename = `media-${Date.now()}.${ext}`;
      const mime = blob.type || (type === "image" ? "image/jpeg" : "video/mp4");
      const file = new File([blob], filename, { type: mime });

      // iOS/Android нативно: @capacitor-community/media — прямо в галерею
      if (isNative()) {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const ok = await saveMediaToGallery(dataUrl, type === "image" ? "image" : "video");
        if (ok) {
          toast({ title: "Сохранено в галерею" });
          triggerLightHaptic();
        } else {
          throw new Error("save failed");
        }
        return;
      }

      // Веб: Share API (мобильный) или blob + download (десктоп)
      const canShare = typeof navigator.share === "function" && (navigator.canShare?.({ files: [file] }) !== false);
      if (canShare) {
        try {
          await navigator.share({ files: [file], title: filename });
          toast({ title: "Сохранено" });
          triggerLightHaptic();
        } catch (shareErr) {
          if ((shareErr as Error)?.name === "AbortError") return;
          const a = document.createElement("a");
          const objectUrl = URL.createObjectURL(blob);
          a.href = objectUrl;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
          toast({ title: "Сохранено" });
          triggerLightHaptic();
        }
      } else {
        const a = document.createElement("a");
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
        toast({ title: "Сохранено" });
        triggerLightHaptic();
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      toast({ title: "Не удалось сохранить", variant: "destructive" });
    } finally {
      setSaving(false);
      setShowActions(false);
    }
  }, [src, type, toast]);

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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal
          aria-label="Просмотр медиа"
        >
          <div className="absolute inset-x-0 top-0 flex justify-end pt-safe-offset-2 pr-4 z-10">
            <TapScaleButton
              type="button"
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" />
            </TapScaleButton>
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
                Удерживайте 3 сек для сохранения
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
            {loadError ? (
              <p className="text-white/80 text-center">Не удалось загрузить медиа</p>
            ) : isImage ? (
              <img
                src={src}
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
            ) : (
              <video
                src={src}
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
                  onClick={saveFile}
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
