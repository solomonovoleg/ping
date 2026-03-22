export type ExternalVideoProvider = "youtube" | "rutube" | "yandex";

export type ExternalVideoEmbed = {
  provider: ExternalVideoProvider;
  watchUrl: string;
  embedUrl: string;
};

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
    return parseYouTube(url) ?? parseRutube(url) ?? parseYandex(url);
  } catch {
    return null;
  }
}
