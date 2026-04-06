/**
 * Согласование image_url и media_urls для ответов API.
 * После PATCH иногда обновляется только превью-колонка (image_url), а jsonb (media_urls) остаётся старым —
 * клиент тогда видит прошлое медиа. Приоритет у image_url как у «головного» URL после редактирования.
 */
export function normalizePostMediaPublic(
  imageUrl: string | null | undefined,
  mediaUrlsRaw: unknown,
): { imageUrl: string | null; mediaUrls: string[] } {
  const urls = Array.isArray(mediaUrlsRaw)
    ? (mediaUrlsRaw as unknown[])
        .filter((u): u is string => typeof u === "string" && u.trim() !== "")
        .map((u) => u.trim())
        .slice(0, 10)
    : [];
  const img = typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null;

  if (urls.length === 0) {
    return { imageUrl: img, mediaUrls: img ? [img] : [] };
  }
  if (!img) {
    return { imageUrl: urls[0] ?? null, mediaUrls: urls };
  }
  if (urls[0] === img) {
    return { imageUrl: img, mediaUrls: urls };
  }
  // Один файл в jsonb, но превью уже другое — типичный случай «заменил фото при редактировании».
  if (urls.length === 1) {
    return { imageUrl: img, mediaUrls: [img] };
  }
  // Несколько медиа: новый первый кадр уже в image_url, тот же URL есть в списке — поднимаем его вперёд.
  if (urls.includes(img)) {
    const rest = urls.filter((u) => u !== img);
    return { imageUrl: img, mediaUrls: [img, ...rest].slice(0, 10) };
  }
  // Новый первый URL только в image_url — подставляем его в начало, хвост без старого первого.
  return { imageUrl: img, mediaUrls: [img, ...urls.slice(1)].slice(0, 10) };
}
