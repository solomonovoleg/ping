import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIZE = 280;
const OUTPUT_SIZE = 256;

export type AvatarCropModalProps = {
  imageDataUrl: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
  className?: string;
};

export function AvatarCropModal({ imageDataUrl, onConfirm, onCancel, className }: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const radius = SIZE / 2;

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const fit = Math.min(SIZE / img.width, SIZE / img.height);
      setScale(fit);
      setOffsetX(0);
      setOffsetY(0);
      setReady(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !ready) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.translate(radius + offsetX, radius + offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
  }, [ready, scale, offsetX, offsetY, radius]);

  useEffect(() => {
    draw();
  }, [draw]);

  const getCroppedDataUrl = useCallback((): string => {
    const img = imgRef.current;
    if (!img) return imageDataUrl;
    const out = document.createElement("canvas");
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext("2d");
    if (!ctx) return imageDataUrl;
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    const s = (scale * OUTPUT_SIZE) / SIZE;
    const dx = (offsetX * OUTPUT_SIZE) / SIZE;
    const dy = (offsetY * OUTPUT_SIZE) / SIZE;
    ctx.translate(OUTPUT_SIZE / 2 + dx, OUTPUT_SIZE / 2 + dy);
    ctx.scale(s, s);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    return out.toDataURL("image/jpeg", 0.88);
  }, [imageDataUrl, scale, offsetX, offsetY]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((prev) => Math.max(0.2, Math.min(4, prev * (1 + delta))));
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
      setScale((prev) => Math.max(0.2, Math.min(4, pinchStart.current!.scale * ratio)));
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
      className={cn("fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm", className)}
      onClick={onCancel}
    >
      <div
        className="bg-background rounded-2xl shadow-xl border border-border overflow-hidden w-full max-w-[328px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border text-center text-sm font-medium text-muted-foreground">
          Переместите и масштабируйте фото (два пальца — зум на телефоне)
        </div>
        <div
          className="relative select-none touch-none"
          style={{ width: SIZE, height: SIZE, touchAction: "none" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-move rounded-full border-2 border-border"
            style={{ borderRadius: "50%" }}
          />
        </div>
        <div className="p-3 flex gap-2">
          <Button type="button" variant="outline" className="flex-1 min-h-[var(--uix-touch-min)]" onClick={onCancel} aria-label="Отмена, не сохранять">
            Отмена
          </Button>
          <Button
            type="button"
            className="flex-1 min-h-[var(--uix-touch-min)]"
            onClick={() => onConfirm(getCroppedDataUrl())}
            aria-label="Готово, сохранить аватар"
          >
            Готово
          </Button>
        </div>
      </div>
    </div>
  );
}
