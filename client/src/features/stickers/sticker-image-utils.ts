/** Расширения как у multer на сервере + типичные варианты с телефона. */
const STICKER_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif)$/i;

/**
 * PNG, JPEG, WebP, GIF, HEIC/HEIF (в т.ч. когда `file.type` пустой — часто на iOS).
 */
export function isStickerImageFile(file: File): boolean {
  const t = (file.type || "").toLowerCase().trim();
  if (t.startsWith("image/")) return true;
  return STICKER_EXT_RE.test(file.name || "");
}

/** Атрибут accept: явные расширения помогают iOS показать HEIC в диалоге. */
export const STICKER_FILE_INPUT_ACCEPT = "image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif";
