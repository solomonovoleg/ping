import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import {
  PULSE_PROFILE_AVATAR_INNER_PX,
  PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX,
} from "@/features/profile/pulse-profile";
import {
  drawSquareAvatarCrop,
  initialScaleCoverSquare,
  squareAvatarCropToDataUrl,
} from "@/lib/avatar-square-crop";

const PREVIEW_FRAME = 280;
/** Экспорт на сервер — достаточно для чёткого отображения на экране. */
const OUTPUT_SIZE = 512;
/** Лёгкое превью для двух миниатюр под кропом. */
const PREVIEW_THUMB_SIZE = 168;

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
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);

  const getTouchDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const fit = initialScaleCoverSquare(img.width, img.height, PREVIEW_FRAME);
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
    canvas.width = PREVIEW_FRAME;
    canvas.height = PREVIEW_FRAME;
    drawSquareAvatarCrop(ctx, img, PREVIEW_FRAME, scale, offsetX, offsetY);
  }, [ready, scale, offsetX, offsetY]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !ready) {
      setPreviewDataUrl(null);
      return;
    }
    const url = squareAvatarCropToDataUrl(
      img,
      PREVIEW_FRAME,
      PREVIEW_THUMB_SIZE,
      scale,
      offsetX,
      offsetY,
      0.82
    );
    setPreviewDataUrl(url || null);
  }, [ready, scale, offsetX, offsetY]);

  const getCroppedDataUrl = useCallback((): string => {
    const img = imgRef.current;
    if (!img) return imageDataUrl;
    return squareAvatarCropToDataUrl(img, PREVIEW_FRAME, OUTPUT_SIZE, scale, offsetX, offsetY, 0.88) || imageDataUrl;
  }, [imageDataUrl, scale, offsetX, offsetY]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setScale((prev) => Math.max(0.2, Math.min(5, prev * (1 + delta))));
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
      setScale(() => Math.max(0.2, Math.min(5, pinchStart.current!.scale * ratio)));
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
        className="bg-background rounded-2xl shadow-xl border border-border overflow-hidden w-full max-w-[360px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border space-y-1">
          <p className="text-center text-sm font-semibold text-foreground">Кадрирование аватара</p>
          <p className="text-center text-xs text-muted-foreground leading-snug">
            Сохраняем <span className="font-medium text-foreground">квадрат</span>: в профиле он станет со скруглёнными углами, в чатах и списках — кругом. Ниже видно оба варианта.
          </p>
        </div>
        <div
          className="relative mx-auto flex justify-center pt-2"
          style={{ width: PREVIEW_FRAME, height: PREVIEW_FRAME }}
        >
          <div
            className="relative select-none touch-none overflow-hidden rounded-lg border-2 border-dashed border-primary/35 bg-muted/30"
            style={{ width: PREVIEW_FRAME, height: PREVIEW_FRAME, touchAction: "none" }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            <canvas ref={canvasRef} className="block h-full w-full cursor-move" width={PREVIEW_FRAME} height={PREVIEW_FRAME} />
          </div>
        </div>

        {previewDataUrl ? (
          <div className="px-3 pt-3 pb-1">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Как будет в приложении
            </p>
            <div className="flex items-end justify-center gap-8">
              <div className="flex flex-col items-center gap-1.5">
                <UserAvatar
                  avatarUrl={previewDataUrl}
                  displayName=" "
                  seed="crop-preview"
                  size={PULSE_PROFILE_AVATAR_INNER_PX}
                  cornerRadius={PULSE_PROFILE_AVATAR_SQUIRCLE_INNER_RX}
                  className="ring-2 ring-border shadow-sm"
                />
                <span className="max-w-[100px] text-center text-[10px] leading-tight text-muted-foreground">
                  Профиль (сквиркл)
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <UserAvatar
                  avatarUrl={previewDataUrl}
                  displayName=" "
                  seed="crop-preview"
                  size={56}
                  className="ring-2 ring-border shadow-sm"
                />
                <span className="max-w-[100px] text-center text-[10px] leading-tight text-muted-foreground">
                  Чаты и списки (круг)
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="p-3 flex gap-2 border-t border-border">
          <Button type="button" variant="outline" className="flex-1 min-h-[var(--uix-touch-min)]" onClick={onCancel} aria-label="Отмена">
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
