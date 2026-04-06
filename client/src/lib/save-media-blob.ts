/**
 * Сохранение медиа на устройство: галерея (нативно), Share API или скачивание blob.
 */
import { isNative, saveMediaToGallery, triggerLightHaptic } from "@/lib/capacitor-native";

export type SaveBlobGalleryHint = "image" | "video" | null;

export async function saveBlobToDevice(
  blob: Blob,
  opts: { filename: string; galleryHint: SaveBlobGalleryHint }
): Promise<void> {
  const { filename, galleryHint } = opts;
  const mime =
    blob.type ||
    (galleryHint === "image" ? "image/jpeg" : galleryHint === "video" ? "video/mp4" : "application/octet-stream");
  const file = new File([blob], filename, { type: mime });

  if (isNative() && galleryHint) {
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const ok = await saveMediaToGallery(dataUrl, galleryHint === "image" ? "image" : "video");
    if (!ok) throw new Error("save failed");
    triggerLightHaptic();
    return;
  }

  const canShare =
    typeof navigator.share === "function" && (navigator.canShare?.({ files: [file] }) !== false);
  if (canShare) {
    try {
      await navigator.share({ files: [file], title: filename });
      triggerLightHaptic();
      return;
    } catch (shareErr) {
      if ((shareErr as Error)?.name === "AbortError") throw shareErr;
    }
  }

  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  a.href = objectUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
  triggerLightHaptic();
}
