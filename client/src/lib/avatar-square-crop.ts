/**
 * Квадратный кроп аватара под все маски в приложении (сквиркл в профиле PULSE, круг в чатах).
 * Сохраняем квадрат JPEG; форма задаётся только через CSS (`border-radius` / `rounded-full`).
 */

export function drawSquareAvatarCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  frameSize: number,
  scale: number,
  offsetX: number,
  offsetY: number
): void {
  ctx.clearRect(0, 0, frameSize, frameSize);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, frameSize, frameSize);
  ctx.clip();
  ctx.translate(frameSize / 2 + offsetX, frameSize / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  ctx.restore();
}

/** Масштаб «заполнить квадрат» (аналог object-cover). */
export function initialScaleCoverSquare(imgW: number, imgH: number, frameSize: number): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.max(frameSize / imgW, frameSize / imgH);
}

export function squareAvatarCropToDataUrl(
  img: HTMLImageElement,
  previewSize: number,
  outputSize: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  quality = 0.88
): string {
  const out = document.createElement("canvas");
  out.width = outputSize;
  out.height = outputSize;
  const ctx = out.getContext("2d");
  if (!ctx) return "";
  const s = (scale * outputSize) / previewSize;
  const dx = (offsetX * outputSize) / previewSize;
  const dy = (offsetY * outputSize) / previewSize;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, outputSize, outputSize);
  ctx.clip();
  ctx.translate(outputSize / 2 + dx, outputSize / 2 + dy);
  ctx.scale(s, s);
  ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
  ctx.restore();
  return out.toDataURL("image/jpeg", quality);
}
