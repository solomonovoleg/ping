export type ExternalVideoProvider = "youtube" | "rutube" | "yandex" | "vk";

export type ExternalVideoEmbed = {
  provider: ExternalVideoProvider;
  watchUrl: string;
  /** Пустая строка — встроенный плеер недоступен, UI покажет fallback на внешний просмотр. */
  embedUrl: string;
};

const PROVIDER_LABEL: Record<ExternalVideoProvider, string> = {
  youtube: "YouTube",
  rutube: "RuTube",
  yandex: "Яндекс Видео",
  vk: "ВКонтакте",
};

export function externalVideoProviderLabel(p: ExternalVideoProvider): string {
  return PROVIDER_LABEL[p];
}

function normalizeYouTubeVideoId(raw: string): string | null {
  const id = raw.trim();
  if (!id) return null;
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
  return id;
}

function parseYouTube(url: URL): ExternalVideoEmbed | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  let videoId: string | null = null;

  if (host === "youtu.be") {
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    videoId = normalizeYouTubeVideoId(first);
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      videoId = normalizeYouTubeVideoId(url.searchParams.get("v") ?? "");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      const marker = parts[0] ?? "";
      if (marker === "shorts" || marker === "live" || marker === "embed") {
        videoId = normalizeYouTubeVideoId(parts[1] ?? "");
      }
    }
  }

  if (!videoId) return null;
  return {
    provider: "youtube",
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

function parseRutube(url: URL): ExternalVideoEmbed | null {
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "rutube.ru") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  const videoIndex = parts.findIndex((part) => part === "video");
  if (videoIndex < 0) return null;
  const videoId = parts[videoIndex + 1] ?? "";
  if (!/^[a-zA-Z0-9]{8,}$/.test(videoId)) return null;

  return {
    provider: "rutube",
    watchUrl: `https://rutube.ru/video/${videoId}/`,
    embedUrl: `https://rutube.ru/play/embed/${videoId}`,
  };
}

function parseVk(url: URL): ExternalVideoEmbed | null {
  const host = url.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
  if (host !== "vk.com" && host !== "vk.ru") return null;

  const path = url.pathname;
  if (/^\/video_ext\.php$/i.test(path)) {
    const oid = url.searchParams.get("oid") ?? "";
    const id = url.searchParams.get("id") ?? "";
    const hash = (url.searchParams.get("hash") ?? "").trim();
    if (!/^-?\d+$/.test(oid) || !/^\d+$/.test(id)) return null;
    const watchUrl = `https://vk.com/video${oid}_${id}`;
    const embedParams = new URLSearchParams({ oid, id, hd: "2" });
    if (hash) embedParams.set("hash", hash);
    return {
      provider: "vk",
      watchUrl,
      embedUrl: `https://vk.com/video_ext.php?${embedParams.toString()}`,
    };
  }

  const clip = path.match(/^\/clip(-?\d+)_(\d+)/i);
  const video = path.match(/^\/video(-?\d+)_(\d+)/i);
  const m = video ?? clip;
  if (!m) return null;

  const ownerId = m[1] ?? "";
  const videoId = m[2] ?? "";
  if (!/^-?\d+$/.test(ownerId) || !/^\d+$/.test(videoId)) return null;

  const kind = clip ? "clip" : "video";
  const watchUrl = `https://vk.com/${kind}${ownerId}_${videoId}`;
  const embedParams = new URLSearchParams({ oid: ownerId, id: videoId, hd: "2" });

  return {
    provider: "vk",
    watchUrl,
    embedUrl: `https://vk.com/video_ext.php?${embedParams.toString()}`,
  };
}

function parseYandex(url: URL): ExternalVideoEmbed | null {
  const host = url.hostname.toLowerCase();
  const isYandexVideoHost =
    host === "yandex.ru" ||
    host === "www.yandex.ru" ||
    host.endsWith(".yandex.ru") ||
    host === "ya.ru" ||
    host === "dzen.ru" ||
    host === "www.dzen.ru";
  if (!isYandexVideoHost) return null;

  const looksLikeVideoPath =
    /\/video(\/|$)/i.test(url.pathname) ||
    /\/player\//i.test(url.pathname) ||
    /\/watch\//i.test(url.pathname);
  if (!looksLikeVideoPath) return null;

  // Для Яндекс Видео нет стабильного универсального embed-эндпоинта,
  // поэтому используем исходную ссылку: если iframe запрещён, UI покажет fallback.
  return {
    provider: "yandex",
    watchUrl: url.toString(),
    embedUrl: url.toString(),
  };
}

export function parseExternalVideoUrl(rawUrl: string): ExternalVideoEmbed | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return parseYouTube(url) ?? parseRutube(url) ?? parseVk(url) ?? parseYandex(url);
  } catch {
    return null;
  }
}
