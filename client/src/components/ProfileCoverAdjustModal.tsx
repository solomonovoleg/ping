import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PROFILE_COVER_REF_WIDTH_PX,
  drawProfileCoverInFrame,
  profileCoverFrameToJpegBlob,
  profileCoverInitialScale,
} from "@/lib/profile-cover-editor";
import { PULSE_PROFILE_COVER_HEIGHT_PX } from "@/features/profile/pulse-profile/layout/constants";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useToast } from "@/hooks/use-toast";

const PREVIEW_W = 340;
const PREVIEW_H = Math.round((PREVIEW_W * PULSE_PROFILE_COVER_HEIGHT_PX) / PROFILE_COVER_REF_WIDTH_PX);

export type ProfileCoverAdjustModalProps = {
  imageDataUrl: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  className?: string;
};

export function ProfileCoverAdjustModal({ imageDataUrl, onConfirm, onCancel, className }: ProfileCoverAdjustModalProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fitScale, setFitScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const minScale = Math.max(0.15, fitScale * 0.35);
  const maxScale = fitScale * 6;

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const fit = profileCoverInitialScale(img.width, img.height, PREVIEW_W, PREVIEW_H);
      setFitScale(fit);
      setScale(fit);
      setOffsetX(0);
      setOffsetY(0);
      setReady(true);
    };
    img.onerror = () => setReady(false);
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;
    drawProfileCoverInFrame(ctx, img, PREVIEW_W, PREVIEW_H, scale, offsetX, offsetY);
  }, [ready, scale, offsetX, offsetY]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleConfirm = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !ready) return;
    setExporting(true);
    try {
      const blob = await profileCoverFrameToJpegBlob(img, PREVIEW_W, PREVIEW_H, scale, offsetX, offsetY);
      const file = new File([blob], "cover.jpg", { type: "image/jpeg" });
      onConfirm(file);
    } catch {
      toast({ title: "Не удалось подготовить обложку", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [ready, scale, offsetX, offsetY, onConfirm, toast]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setScale((prev) => Math.max(minScale, Math.min(maxScale, prev * (1 + delta))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, offsetX, offsetY };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      setOffsetX(dragStart.current.offsetX + (e.clientX - dragStart.current.x));
      setOffsetY(dragStart.current.offsetY + (e.clientY - dragStart.current.y));
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchStart.current = {
        distance: getTouchDistance(e.touches[0], e.touches[1]),
        scale,
      };
      setDragging(false);
      return;
    }
    if (e.touches.length === 1) {
      pinchStart.current = null;
      setDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        offsetX,
        offsetY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dist = getTouchDistance(e.touches[0], e.touches[1]);
      const ratio = dist / pinchStart.current.distance;
      setScale(() => Math.max(minScale, Math.min(maxScale, pinchStart.current!.scale * ratio)));
      return;
    }
    if (dragging && e.touches.length === 1) {
      e.preventDefault();
      setOffsetX(dragStart.current.offsetX + (e.touches[0].clientX - dragStart.current.x));
      setOffsetY(dragStart.current.offsetY + (e.touches[0].clientY - dragStart.current.y));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchStart.current = null;
    if (e.touches.length === 0) setDragging(false);
  };

  return (
    <div
      className={cn("fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4", className)}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-cover-adjust-title"
    >
      <div
        className="bg-background rounded-t-2xl sm:rounded-2xl shadow-xl border border-border overflow-hidden w-full max-w-[400px] max-h-[min(92dvh,720px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border shrink-0">
          <h2 id="profile-cover-adjust-title" className="text-center text-sm font-semibold text-foreground">
            Обложка профиля
          </h2>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Перетащите по сетке, колёсико или слайдер — масштаб; на телефоне — два пальца для зума.
          </p>
        </div>

        <div className="px-3 pt-2 pb-1 flex-1 min-h-0 flex flex-col items-center overflow-y-auto">
          <div
            className={cn(
              "relative select-none touch-none rounded-xl overflow-hidden border-2 border-border bg-black/20",
              !reducedMotion && "ring-1 ring-primary/20"
            )}
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              touchAction: "none",
            }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              className="block w-full h-full cursor-move"
              width={PREVIEW_W}
              height={PREVIEW_H}
              aria-hidden
            />
            {/* Сетка 3×3 — ориентир для кадрирования */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.22]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.9) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.9) 1px, transparent 1px)
                `,
                backgroundSize: "33.333% 33.333%",
              }}
              aria-hidden
            />
          </div>

          <div className="mt-3 w-full max-w-[340px] space-y-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="cover-scale-range">
              Масштаб
            </label>
            <input
              id="cover-scale-range"
              type="range"
              min={minScale}
              max={maxScale}
              step={Math.max(0.0001, (maxScale - minScale) / 120)}
              value={Math.min(maxScale, Math.max(minScale, scale))}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full h-2 accent-primary"
            />
          </div>
        </div>

        <div className="p-3 flex gap-2 border-t border-border shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="flex-1 min-h-[var(--uix-touch-min)]"
            onClick={onCancel}
            disabled={exporting}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="flex-1 min-h-[var(--uix-touch-min)]"
            onClick={() => void handleConfirm()}
            disabled={!ready || exporting}
          >
            {exporting ? "Сохранение…" : "Готово"}
          </Button>
        </div>
      </div>
    </div>
  );
}
