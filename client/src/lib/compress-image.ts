/**
 * Сжатие изображения перед загрузкой: уменьшение размера и качества для быстрой отправки.
 */

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 0.85;

/** Edge/WebView иногда отдаёт пустой MIME — по расширению всё равно пробуем canvas. */
function shouldTryDecodeAsRasterImage(file: File): boolean {
  const t = (file.type || "").toLowerCase().trim();
  if (t.startsWith("image/")) return true;
  if (t.length > 0) return false;
  return /\.(jpe?g|png|gif|webp)$/i.test(file.name || "");
}

/** Форматы, где на входе может быть альфа (не JPEG). */
function fileMayHaveTransparency(file: File): boolean {
  const t = (file.type || "").toLowerCase().trim();
  if (t === "image/png" || t === "image/webp" || t === "image/gif") return true;
  if (t === "image/jpeg" || t === "image/jpg") return false;
  if (t.startsWith("image/") && t.length > 0) return false;
  return /\.(png|webp|gif)$/i.test(file.name || "");
}

export async function compressImage(
  file: File,
  options: { maxWidth?: number; quality?: number; preserveTransparency?: boolean } = {},
): Promise<File> {
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_WIDTH;
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (!shouldTryDecodeAsRasterImage(file)) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (w <= maxWidth && h <= maxWidth && file.size < 500_000) {
        resolve(file);
        return;
      }
      const scale = Math.min(1, maxWidth / w, maxWidth / h);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);

      const useAlphaOutput = options.preserveTransparency === true && fileMayHaveTransparency(file);
      const baseName = file.name.replace(/\.[^.]+$/, "") || "image";

      if (useAlphaOutput) {
        const finishAlpha = (blob: Blob | null, ext: string, mime: string, onFail: () => void) => {
          if (blob && blob.size > 0) {
            resolve(new File([blob], `${baseName}${ext}`, { type: mime }));
          } else {
            onFail();
          }
        };
        const inputIsPng =
          (file.type || "").toLowerCase().trim() === "image/png" || /\.png$/i.test(file.name || "");
        /** PNG с альфой (персонаж EDGE и т.п.): при ресайзе сначала PNG — стабильная прозрачность везде; WebP с альфой — запасной вариант. */
        if (inputIsPng) {
          canvas.toBlob(
            (blob) => {
              finishAlpha(blob, ".png", "image/png", () => {
                canvas.toBlob(
                  (blob2) => {
                    finishAlpha(blob2, ".webp", "image/webp", () => resolve(file));
                  },
                  "image/webp",
                  quality,
                );
              });
            },
            "image/png",
          );
          return;
        }
        canvas.toBlob(
          (blob) => {
            finishAlpha(blob, ".webp", "image/webp", () => {
              canvas.toBlob(
                (blob2) => {
                  finishAlpha(blob2, ".png", "image/png", () => resolve(file));
                },
                "image/png",
              );
            });
          },
          "image/webp",
          quality,
        );
        return;
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
