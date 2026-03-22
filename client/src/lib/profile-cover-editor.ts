import { PULSE_PROFILE_COVER_HEIGHT_PX } from "@/features/profile/pulse-profile/layout/constants";

/** Эталонная ширина контента под обложку в макете PULSE (~390 CSS px). */
export const PROFILE_COVER_REF_WIDTH_PX = 390;

/** Соотношение сторон рамки обложки как в профиле (ширина / высота). */
export function profileCoverFrameAspectRatio(): number {
  return PROFILE_COVER_REF_WIDTH_PX / PULSE_PROFILE_COVER_HEIGHT_PX;
}

/** Масштаб «впору», чтобы изображение полностью закрыло рамку (object-cover). */
export function profileCoverInitialScale(imgW: number, imgH: number, frameW: number, frameH: number): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.max(frameW / imgW, frameH / imgH);
}

/** Размер выходного JPEG (ширина фиксирована, высота по пропорции макета). */
export function profileCoverExportDimensions(maxWidth = 1280): { outW: number; outH: number } {
  const outW = maxWidth;
  const outH = Math.round((outW * PULSE_PROFILE_COVER_HEIGHT_PX) / PROFILE_COVER_REF_WIDTH_PX);
  return { outW, outH };
}

/**
 * Рисует фрагмент обложки: центр рамки + смещение, масштаб от центра изображения.
 * Порядок как у квадратного кропа аватара: clip прямоугольником, translate центра рамки, scale, drawImage по центру картинки.
 */
export function drawProfileCoverInFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameW: number,
  frameH: number,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  ctx.clearRect(0, 0, frameW, frameH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, frameW, frameH);
  ctx.clip();
  ctx.translate(frameW / 2 + offsetX, frameH / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  ctx.restore();
}

/** Экспорт кадра в JPEG-Blob заданного пиксельного размера. */
export function profileCoverFrameToJpegBlob(
  img: HTMLImageElement,
  previewW: number,
  previewH: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  quality = 0.88,
  maxExportWidth = 1280
): Promise<Blob> {
  const { outW, outH } = profileCoverExportDimensions(maxExportWidth);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas unsupported"));
  const sx = outW / previewW;
  const sy = outH / previewH;
  const outScale = scale * sx;
  const outOx = offsetX * sx;
  const outOy = offsetY * sy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outW, outH);
  ctx.clip();
  ctx.translate(outW / 2 + outOx, outH / 2 + outOy);
  ctx.scale(outScale, outScale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  ctx.restore();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Не удалось сформировать изображение"));
      },
      "image/jpeg",
      quality
    );
  });
}

/** Загрузить картинку по URL (тот же origin / CORS) в data URL для редактора обложки. */
export function fetchImageAsDataUrl(url: string): Promise<string> {
  return fetch(url, { credentials: "include", mode: "cors" })
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(blob);
        })
    );
}
