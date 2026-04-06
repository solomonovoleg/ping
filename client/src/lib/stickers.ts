import { API, apiFetch, postFormDataWithUploadProgress } from "@/lib/api-base";

/** Совпадает с multer `array("files", …)` на сервере. */
export const STICKER_FILES_MAX_PER_UPLOAD = 40;

export type StickerPackVisibility = "private" | "public";

export type StickerItem = {
  id: string;
  imageUrl: string;
  sortOrder: number;
};

export type StickerPackSummary = {
  id: string;
  title: string;
  visibility: string;
  createdAt: string;
  stickers: StickerItem[];
};

export type PublicStickerPackSearchHit = {
  id: string;
  title: string;
  ownerUserId: string;
  createdAt: string;
};

export async function fetchMyStickerPacks(): Promise<{ packs: StickerPackSummary[] }> {
  const res = await apiFetch(`${API}/sticker-packs/mine`);
  if (!res.ok) throw new Error("Не удалось загрузить стикеры");
  return res.json() as Promise<{ packs: StickerPackSummary[] }>;
}

export async function searchPublicStickerPacks(q: string, limit = 20): Promise<{ packs: PublicStickerPackSearchHit[] }> {
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const res = await apiFetch(`${API}/sticker-packs/public?${params}`);
  if (!res.ok) throw new Error("Не удалось выполнить поиск");
  return res.json() as Promise<{ packs: PublicStickerPackSearchHit[] }>;
}

export async function fetchStickerPackDetail(packId: string): Promise<{
  pack: { id: string; title: string; visibility: string; ownerUserId: string; createdAt: string };
  stickers: StickerItem[];
}> {
  const res = await apiFetch(`${API}/sticker-packs/${encodeURIComponent(packId)}`);
  if (!res.ok) throw new Error("Не удалось загрузить набор");
  return res.json() as Promise<{
    pack: { id: string; title: string; visibility: string; ownerUserId: string; createdAt: string };
    stickers: StickerItem[];
  }>;
}

export async function createStickerPackWithFiles(
  title: string,
  visibility: StickerPackVisibility,
  files: File[],
  options?: { onProgress?: (p: number) => void },
): Promise<{ pack: StickerPackSummary }> {
  const fd = new FormData();
  fd.append("title", title.trim());
  fd.append("visibility", visibility);
  for (const f of files) fd.append("files", f);
  const url = `${API}/sticker-packs/create-with-stickers`;
  const { ok, status, bodyText } = await postFormDataWithUploadProgress(url, fd, {
    onProgress: options?.onProgress,
    timeoutMs: 120_000,
  });
  if (!ok) {
    let message = "Не удалось создать набор";
    try {
      const j = JSON.parse(bodyText) as { message?: string };
      if (j.message) message = j.message;
    } catch {
      if (bodyText) message = bodyText.slice(0, 200);
    }
    throw new Error(message);
  }
  const data = JSON.parse(bodyText) as {
    pack: { id: string; title: string; visibility: string; createdAt: string };
    stickers: StickerItem[];
  };
  return {
    pack: {
      id: data.pack.id,
      title: data.pack.title,
      visibility: data.pack.visibility,
      createdAt: data.pack.createdAt,
      stickers: data.stickers,
    },
  };
}

export async function addStickersToPack(
  packId: string,
  files: File[],
  options?: { onProgress?: (p: number) => void },
): Promise<{ stickers: StickerItem[] }> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const url = `${API}/sticker-packs/${encodeURIComponent(packId)}/stickers`;
  const { ok, bodyText } = await postFormDataWithUploadProgress(url, fd, {
    onProgress: options?.onProgress,
    timeoutMs: 120_000,
  });
  if (!ok) {
    let message = "Не удалось добавить стикеры";
    try {
      const j = JSON.parse(bodyText) as { message?: string };
      if (j.message) message = j.message;
    } catch {}
    throw new Error(message);
  }
  return JSON.parse(bodyText) as Promise<{ stickers: StickerItem[] }>;
}

export async function patchStickerPack(
  packId: string,
  patch: { title?: string; visibility?: StickerPackVisibility },
): Promise<void> {
  const res = await apiFetch(`${API}/sticker-packs/${encodeURIComponent(packId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось сохранить");
  }
}

export async function deleteStickerPack(packId: string): Promise<void> {
  const res = await apiFetch(`${API}/sticker-packs/${encodeURIComponent(packId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось удалить набор");
  }
}

export async function deleteSticker(stickerId: string): Promise<void> {
  const res = await apiFetch(`${API}/stickers/${encodeURIComponent(stickerId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось удалить стикер");
  }
}
