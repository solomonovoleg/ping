import { parseExternalVideoUrl, type ExternalVideoEmbed } from "./external-video";

export function normalizeCaptionHref(part: string): string {
  if (/^https?:\/\//i.test(part)) return part;
  return `https://${part}`;
}

/** Первый URL в тексте, распознаваемый как внешнее видео (YouTube, RuTube, VK, Яндекс). */
export function extractFirstExternalVideoUrl(text: string): string | null {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
  for (const part of parts) {
    if (!part) continue;
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const href = normalizeCaptionHref(part);
      if (parseExternalVideoUrl(href)) return href;
    }
  }
  return null;
}

export function externalVideoMatchesFragment(fragment: string, embed: ExternalVideoEmbed): boolean {
  const href = normalizeCaptionHref(fragment);
  const parsed = parseExternalVideoUrl(href);
  if (!parsed) return false;
  if (parsed.watchUrl === embed.watchUrl) return true;
  if (parsed.embedUrl && embed.embedUrl && parsed.embedUrl === embed.embedUrl) return true;
  return false;
}

/**
 * Только ссылка на внешнее видео (и пробелы), без другого текста и хештегов —
 * тогда подпись можно не дублировать: карточка с превью уже есть.
 */
export function isExternalVideoOnlyCaption(text: string, primaryVideoUrl: string | null): boolean {
  if (!primaryVideoUrl?.trim()) return false;
  const embed = parseExternalVideoUrl(primaryVideoUrl);
  if (!embed) return false;
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+|#[a-zA-Zа-яёА-ЯЁ0-9_]+)/g);
  for (const part of parts) {
    if (!part) continue;
    const t = part.trim();
    if (!t) continue;
    if (t.startsWith("#")) return false;
    if (/^(https?:\/\/|www\.)/i.test(t)) {
      if (!externalVideoMatchesFragment(t, embed)) return false;
      continue;
    }
    return false;
  }
  return true;
}

export function youtubePosterUrlsFromEmbedUrl(embedUrl: string): string[] {
  const m = embedUrl.match(/youtube-nocookie\.com\/embed\/([^/?]+)/i) ?? embedUrl.match(/youtube\.com\/embed\/([^/?]+)/i);
  const id = m?.[1];
  if (!id) return [];
  return [`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`];
}
