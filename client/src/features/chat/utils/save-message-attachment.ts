/**
 * Сохранение вложения сообщения чата (фото, видео, кружок, голос, превью поста/сториз).
 */
import { apiFetch, resolveUrl } from "@/lib/api-base";
import { getCachedMediaObjectUrl } from "@/lib/media-offline-cache";
import { saveBlobToDevice, type SaveBlobGalleryHint } from "@/lib/save-media-blob";
import { isLikelyStoryVideoUrl } from "@/lib/story-media";
import type { ApiMessage } from "../types";

function extensionFromMime(mime: string, galleryHint: SaveBlobGalleryHint): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("webm")) return "webm";
  if (m.includes("quicktime") || m.includes("mov")) return "mov";
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("csv")) return "csv";
  if (m.includes("spreadsheetml") || m.includes("xlsx")) return "xlsx";
  if (galleryHint === "image") return "jpg";
  if (galleryHint === "video") return "mp4";
  return "bin";
}

type AttachmentSpec = {
  /** URL для fetch / кэша (как в пузыре сообщения). */
  remoteUrl: string;
  galleryHint: SaveBlobGalleryHint;
};

function specFromMessage(msg: ApiMessage): AttachmentSpec | null {
  if (msg.sendStatus === "sending") return null;

  const t = msg.type;
  if (t === "image" || t === "video" || t === "video_note") {
    const raw = (msg.content || "").trim();
    if (!raw) return null;
    const remoteUrl = resolveUrl(raw);
    return {
      remoteUrl,
      galleryHint: t === "image" ? "image" : "video",
    };
  }

  if (t === "voice") {
    const raw = (msg.content || "").trim();
    if (!raw) return null;
    return { remoteUrl: resolveUrl(raw), galleryHint: null };
  }

  if (t === "file") {
    try {
      const p = JSON.parse(msg.content || "{}") as { url?: string; name?: string };
      const u = typeof p.url === "string" ? p.url.trim() : "";
      if (!u) return null;
      return { remoteUrl: resolveUrl(u), galleryHint: null };
    } catch {
      return null;
    }
  }

  if (t === "post_share") {
    try {
      const p = JSON.parse(msg.content || "{}") as { imageUrl?: string | null };
      const img = typeof p.imageUrl === "string" ? p.imageUrl.trim() : "";
      if (!img) return null;
      return { remoteUrl: resolveUrl(img), galleryHint: "image" };
    } catch {
      return null;
    }
  }

  if (t === "story_reply") {
    try {
      const p = JSON.parse(msg.content || "{}") as { mediaUrl?: string | null };
      const media = typeof p.mediaUrl === "string" ? p.mediaUrl.trim() : "";
      if (!media) return null;
      const remoteUrl = resolveUrl(media);
      return {
        remoteUrl,
        galleryHint: isLikelyStoryVideoUrl(remoteUrl) ? "video" : "image",
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function messageHasDownloadableAttachment(msg: ApiMessage): boolean {
  return specFromMessage(msg) !== null;
}

async function fetchBlobForChatMedia(remoteUrl: string): Promise<Blob> {
  const cachedObjectUrl = await getCachedMediaObjectUrl(remoteUrl);
  const urlToFetch = cachedObjectUrl ?? remoteUrl;
  if (urlToFetch.startsWith("blob:") || urlToFetch.startsWith("data:")) {
    const r = await fetch(urlToFetch);
    if (!r.ok) throw new Error("fetch failed");
    return r.blob();
  }
  const res = await apiFetch(urlToFetch);
  if (!res.ok) throw new Error("fetch failed");
  return res.blob();
}

const CLIPBOARD_IMAGE_MAX_EDGE_PX = 4096;

/** Растр в PNG для буфера: WebKit/Safari часто принимают только image/png; плюс даунскейл огромных кадров. */
async function rasterBlobToPngBlobForClipboard(blob: Blob): Promise<Blob> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    let { width, height } = bitmap;
    const maxEdge = Math.max(width, height);
    if (maxEdge > CLIPBOARD_IMAGE_MAX_EDGE_PX) {
      const scale = CLIPBOARD_IMAGE_MAX_EDGE_PX / maxEdge;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
    });
    if (!out.size) throw new Error("empty png");
    return out;
  } finally {
    bitmap?.close();
  }
}

async function writeImageBlobToClipboard(blob: Blob): Promise<void> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    throw new Error("clipboard unsupported");
  }

  const writeWithMime = (mime: string, b: Blob) =>
    navigator.clipboard.write([
      new ClipboardItem({
        [mime === "image/jpg" ? "image/jpeg" : mime]: Promise.resolve(b),
      }),
    ]);

  const raw = (blob.type || "").trim().toLowerCase();
  const canTryDirect =
    raw === "image/png" ||
    raw === "image/jpeg" ||
    raw === "image/jpg" ||
    raw === "image/webp" ||
    raw === "image/gif";

  if (canTryDirect) {
    try {
      await writeWithMime(raw, blob);
      return;
    } catch {
      /* re-encode */
    }
  }

  const pngBlob = await rasterBlobToPngBlobForClipboard(blob);
  await writeWithMime("image/png", pngBlob);
}

/** Копирование растрового изображения из сообщения (фото, превью поста/сториз). */
export async function copyChatMessageImageToClipboard(msg: ApiMessage): Promise<void> {
  const spec = specFromMessage(msg);
  if (!spec || spec.galleryHint !== "image") {
    throw new Error("no image attachment");
  }
  const blob = await fetchBlobForChatMedia(spec.remoteUrl);
  if (!blob.size) throw new Error("empty blob");
  await writeImageBlobToClipboard(blob);
}

/** URL для fallback «копировать ссылку» (голос не даём — только файл/медиа). */
export function resolveChatMessageCopyFallbackUrl(msg: ApiMessage): string | null {
  if (msg.type === "voice") return null;
  const spec = specFromMessage(msg);
  return spec?.remoteUrl ?? null;
}

/** Скачивает вложение и сохраняет на устройство. Бросает ошибку при сбое; AbortError — отмена Share. */
export async function saveChatMessageAttachment(msg: ApiMessage): Promise<void> {
  const spec = specFromMessage(msg);
  if (!spec) throw new Error("no attachment");
  const blob = await fetchBlobForChatMedia(spec.remoteUrl);
  const ext = extensionFromMime(blob.type, spec.galleryHint);
  const filename = `ping-${msg.id.slice(0, 8)}-${Date.now()}.${ext}`;
  await saveBlobToDevice(blob, { filename, galleryHint: spec.galleryHint });
}
