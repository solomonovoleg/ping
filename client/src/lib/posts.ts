import {
  API,
  apiFetch,
  humanizeUploadOrNetworkError,
  messageForFetchFailure,
  postFormDataWithUploadProgress,
} from "@/lib/api-base";
import { compressImage } from "@/lib/compress-image";
import type { PostMediaLayout } from "@shared/post-media-layout";
import { AVATAR_VIDEO_MAX_SECONDS } from "@shared/post-video";
import type { PushTtlValue } from "@shared/schema/push-feed";

export type ReactionUser = { id: string; displayName: string | null; surname: string | null; avatarUrl: string | null };

/** Кто видит карточку EDGE в ленте/профиле (сервер: posts.edge_display_audience). */
export type EdgeDisplayAudience = "self" | "followers" | "public";

export function normalizeEdgeDisplayAudienceClient(raw: unknown): EdgeDisplayAudience {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (s === "self" || s === "followers") return s;
  return "public";
}

export type FeedPost = {
  id: string;
  /** Короткий сегмент в публичных ссылках на пост (вместо UUID в пути). */
  linkCode?: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  /** Несколько фото/видео (как ВК). Если пусто — смотри imageUrl. */
  mediaUrls?: string[] | null;
  mediaLayout?: PostMediaLayout | null;
  /** Хештеги из текста поста */
  hashtags?: string[];
  /** Кампания EDGE (интерактив в теле поста) */
  edgeId?: string | null;
  /** Видимость поста (текст/медиа) для чужого профиля */
  visibility?: "public" | "followers";
  /** Аудитория карточки EDGE; только если есть edgeId */
  edgeDisplayAudience?: EdgeDisplayAudience | null;
  /** false — не показывать превью по внешней видеоссылке в тексте */
  linkEmbedEnabled?: boolean;
  reactions: { emoji: string; count: number }[];
  reactionUsers?: Record<string, ReactionUser[]>;
  myReaction: string | null;
  viewsCount: number;
  /** Число пересылок поста в чаты (post_shares). */
  sharesCount?: number;
  /** Сохранён ли пост у текущего зрителя. */
  isSaved?: boolean;
  createdAt: string;
  channelName: string;
  author: { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null };
  commentsCount: number;
  latestComments?: {
    id: string;
    postId: string;
    userId?: string;
    text: string;
    createdAt: string;
    user: string;
    avatar: string | null;
    likes: number;
  }[];
};

export type PostVideoTrimUpload = { trimStartSec: number; trimDurationSec: number };

/** Для аватара передать trimMaxSeconds: AVATAR_VIDEO_MAX_SECONDS — сервер обрежет до 4 с. */
export type UploadPostMediaOptions = {
  trimMaxSeconds?: number;
  /** Прогресс отправки на сервер (0–100), если браузер сообщает размер тела. */
  onProgress?: (percent: number) => void;
};

function buildPostMediaForm(file: File, trim?: PostVideoTrimUpload, options?: UploadPostMediaOptions): FormData {
  const form = new FormData();
  if (trim) {
    form.append("trimStartSec", String(trim.trimStartSec));
    form.append("trimDurationSec", String(trim.trimDurationSec));
  }
  if (options?.trimMaxSeconds === AVATAR_VIDEO_MAX_SECONDS) {
    form.append("trimMaxSeconds", String(AVATAR_VIDEO_MAX_SECONDS));
  }
  form.append("file", file);
  return form;
}

export type UploadPostMediaResult = { url: string; posterUrl?: string };

/** Ответ `/api/upload/post-media`: для видео может быть `posterUrl` (JPEG рядом с MP4 на сервере). */
export async function uploadPostMediaWithMeta(
  file: File,
  trim?: PostVideoTrimUpload,
  options?: UploadPostMediaOptions,
): Promise<UploadPostMediaResult> {
  const form = buildPostMediaForm(file, trim, options);
  let text: string;
  let status: number;
  try {
    const res = await postFormDataWithUploadProgress(`${API}/upload/post-media`, form, {
      onProgress: options?.onProgress,
    });
    text = res.bodyText;
    status = res.status;
  } catch (e) {
    throw new Error(messageForFetchFailure(e));
  }
  let data: { message?: unknown; url?: unknown; posterUrl?: unknown } = {};
  if (text.trim()) {
    try {
      data = JSON.parse(text) as { message?: unknown; url?: unknown; posterUrl?: unknown };
    } catch {
      /* non-JSON body */
    }
  }
  if (status < 200 || status >= 300) {
    if (status === 413) {
      throw new Error(
        "Файл слишком большой: лимит nginx/прокси до приложения. Попробуйте другое фото или уменьшите его; на сервере нужен client_max_body_size не ниже 550m (см. deploy/nginx-ping-moot.conf).",
      );
    }
    const serverMsg = typeof data.message === "string" ? data.message : null;
    throw new Error(
      humanizeUploadOrNetworkError(
        new Error(serverMsg || String(status)),
        `Не удалось загрузить файл (${status})`,
      ),
    );
  }
  const url = typeof data.url === "string" ? data.url.trim() : "";
  if (!url) throw new Error("Сервер не вернул URL файла");
  const posterUrl = typeof data.posterUrl === "string" ? data.posterUrl.trim() : undefined;
  return posterUrl ? { url, posterUrl } : { url };
}

export async function uploadPostMedia(
  file: File,
  trim?: PostVideoTrimUpload,
  options?: UploadPostMediaOptions,
): Promise<string> {
  const { url } = await uploadPostMediaWithMeta(file, trim, options);
  return url;
}

/** Картинка для EDGE (персонаж и т.п.): сжать в браузере, чтобы не упираться в лимит прокси (413). HEIC без декода в canvas уйдёт как есть — тогда помогает только настройка nginx. */
export async function uploadPostMediaImageResized(
  file: File,
  options?: Pick<UploadPostMediaOptions, "onProgress"> & {
    maxWidth?: number;
    quality?: number;
    /** PNG/WebP с альфой: при ресайзе не конвертировать в JPEG (иначе фон станет чёрным). */
    preserveTransparency?: boolean;
  },
): Promise<string> {
  const maxWidth = options?.maxWidth ?? 1536;
  const quality = options?.quality ?? 0.86;
  const prepared =
    file.type.startsWith("image/") && !/^image\/hei[cf]$/i.test(file.type.trim())
      ? await compressImage(file, {
          maxWidth,
          quality,
          preserveTransparency: options?.preserveTransparency,
        })
      : file;
  return uploadPostMedia(prepared, undefined, { onProgress: options?.onProgress });
}

export async function createPost(data: {
  text: string;
  imageUrl?: string | null;
  mediaUrls?: string[];
  mediaLayout?: PostMediaLayout | null;
  /** Кампания EDGE в теле поста. */
  edgeId?: string | null;
  /** false — публиковать без превью по ссылке на внешнее видео */
  linkEmbedEnabled?: boolean;
  sendToPush?: boolean;
  pushTtl?: PushTtlValue;
  /** Только с sendToPush: не показывать пост на стене профиля (отдельный Push из раздела чатов) */
  showOnAuthorWall?: boolean;
}): Promise<{ id: string; linkCode?: string; createdAt: string }> {
  const payload: {
    text: string;
    imageUrl?: string | null;
    mediaUrls?: string[];
    mediaLayout?: PostMediaLayout | null;
    edgeId?: string | null;
    linkEmbedEnabled?: boolean;
    sendToPush?: boolean;
    pushTtl?: PushTtlValue;
    showOnAuthorWall?: boolean;
  } = {
    text: data.text.trim(),
  };
  if (data.mediaUrls?.length) {
    payload.mediaUrls = data.mediaUrls.slice(0, 10);
  } else if (data.imageUrl !== undefined) {
    payload.imageUrl = data.imageUrl ?? null;
  }
  if (data.mediaLayout !== undefined) payload.mediaLayout = data.mediaLayout;
  const e = data.edgeId?.trim();
  if (e) payload.edgeId = e;
  if (data.linkEmbedEnabled === false) payload.linkEmbedEnabled = false;
  if (data.sendToPush === true) payload.sendToPush = true;
  if (data.pushTtl) payload.pushTtl = data.pushTtl;
  if (data.showOnAuthorWall === false) payload.showOnAuthorWall = false;
  const res = await apiFetch(`${API}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body?.message === "string" ? body.message : "Не удалось опубликовать";
    throw new Error(msg);
  }
  return {
    id: body.id,
    ...(typeof body.linkCode === "string" && body.linkCode.trim() ? { linkCode: body.linkCode.trim() } : {}),
    createdAt: body.createdAt ?? new Date().toISOString(),
  };
}

/** Нормализует элемент ленты: гарантирует text и author для безопасного рендера */
export function normalizeFeedPost(raw: unknown): FeedPost | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const authorId = typeof o.authorId === "string" ? o.authorId : "";
  if (!id) return null;
  const author = o.author && typeof o.author === "object" ? (o.author as FeedPost["author"]) : { id: authorId, publicId: 0, displayName: null, surname: null, avatarUrl: null };
  return {
    id,
    ...(typeof o.linkCode === "string" && o.linkCode.trim() ? { linkCode: o.linkCode.trim() } : {}),
    authorId,
    text: typeof o.text === "string" ? o.text : "",
    imageUrl: o.imageUrl != null && o.imageUrl !== "" ? String(o.imageUrl) : null,
    mediaUrls: Array.isArray(o.mediaUrls) ? (o.mediaUrls as string[]) : null,
    mediaLayout: o.mediaLayout && typeof o.mediaLayout === "object" ? (o.mediaLayout as PostMediaLayout) : null,
    hashtags: Array.isArray(o.hashtags) ? (o.hashtags as string[]) : undefined,
    edgeId: typeof o.edgeId === "string" && o.edgeId.trim() ? o.edgeId.trim() : null,
    visibility:
      typeof o.visibility === "string" && o.visibility.toLowerCase() === "followers" ? "followers" : "public",
    edgeDisplayAudience:
      typeof o.edgeId === "string" && o.edgeId.trim()
        ? normalizeEdgeDisplayAudienceClient(o.edgeDisplayAudience)
        : null,
    ...(typeof o.linkEmbedEnabled === "boolean" && o.linkEmbedEnabled === false ? { linkEmbedEnabled: false as const } : {}),
    reactions: Array.isArray(o.reactions) ? (o.reactions as FeedPost["reactions"]) : [],
    reactionUsers: o.reactionUsers && typeof o.reactionUsers === "object" ? (o.reactionUsers as FeedPost["reactionUsers"]) : undefined,
    myReaction: typeof o.myReaction === "string" ? o.myReaction : null,
    viewsCount: typeof o.viewsCount === "number" ? o.viewsCount : 0,
    sharesCount: typeof o.sharesCount === "number" ? o.sharesCount : 0,
    isSaved: o.isSaved === true,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    channelName: typeof o.channelName === "string" ? o.channelName : `ID ${author.publicId ?? ""}`,
    author,
    commentsCount: typeof o.commentsCount === "number" ? o.commentsCount : 0,
    latestComments: Array.isArray(o.latestComments)
      ? (o.latestComments as FeedPost["latestComments"])
      : [],
  };
}

export async function fetchFeed(
  limit?: number,
  offset?: number,
  opts?: { hashtag?: string; q?: string; videoOnly?: boolean },
): Promise<FeedPost[]> {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  if (opts?.hashtag?.trim()) params.set("hashtag", opts.hashtag.trim().replace(/^#/, ""));
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.videoOnly) params.set("videoOnly", "1");
  const res = await apiFetch(`${API}/posts?${params}`, { credentials: "include", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : "Не удалось загрузить ленту");
  }
  const rawList = Array.isArray(data) ? data : [];
  const out: FeedPost[] = [];
  for (const item of rawList) {
    const normalized = normalizeFeedPost(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export async function fetchPostsByAuthor(authorId: string, limit?: number): Promise<FeedPost[]> {
  const params = new URLSearchParams({ authorId });
  if (limit != null) params.set("limit", String(limit));
  const res = await apiFetch(`${API}/posts?${params}`, { credentials: "include", cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.message === "string" ? data.message : "Не удалось загрузить посты");
  }
  const rawList = Array.isArray(data) ? data : [];
  const out: FeedPost[] = [];
  for (const item of rawList) {
    const normalized = normalizeFeedPost(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export async function fetchPost(postId: string): Promise<FeedPost | null> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}`, { credentials: "include", cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data?.message === "string" ? data.message : "Не удалось загрузить пост");
  }
  const data = await res.json().catch(() => null);
  return normalizeFeedPost(data);
}

export async function addReaction(postId: string, emoji: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "Не удалось поставить реакцию");
  }
}

export async function removeReaction(postId: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? "Не удалось убрать реакцию");
  }
}

export async function recordPostView(postId: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/view`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? `Просмотр не учтён (${res.status})`);
  }
}

/** Один повтор при сбое (сеть/5xx); в DEV — предупреждение в консоль. */
export function recordPostViewBestEffort(postId: string): void {
  const run = (isRetry: boolean) => {
    void recordPostView(postId).catch((err) => {
      if (import.meta.env.DEV) {
        console.warn("[recordPostView] failed", { postId, isRetry, err });
      }
      if (!isRetry) {
        window.setTimeout(() => run(true), 1500);
      }
    });
  };
  run(false);
}

export async function recordPostEngagement(
  postId: string,
  payload: { dwellMs?: number; expanded?: boolean; readFull?: boolean }
): Promise<void> {
  await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/engage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
}

export async function deletePost(postId: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 404) {
    throw new Error("Пост не найден");
  }
  if (res.status === 403) {
    throw new Error("Можно удалить только свой пост");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось удалить пост");
  }
}

export async function updatePost(
  postId: string,
  data: {
    text?: string;
    imageUrl?: string | null;
    mediaUrls?: string[] | null;
    mediaLayout?: PostMediaLayout | null;
    visibility?: "public" | "followers";
    edgeDisplayAudience?: EdgeDisplayAudience;
    linkEmbedEnabled?: boolean;
  },
): Promise<{
  id: string;
  text: string;
  imageUrl: string | null;
  mediaUrls?: string[];
  mediaLayout?: PostMediaLayout | null;
  createdAt: string;
  linkEmbedEnabled?: boolean;
}> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? "Не удалось обновить пост");
  return body;
}

export async function savePost(postId: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/save`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось сохранить");
  }
}

export async function unsavePost(postId: string): Promise<void> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/save`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) ?? "Не удалось убрать из сохранённого");
  }
}

export async function fetchSavedPosts(limit?: number, offset?: number): Promise<FeedPost[]> {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (offset != null) params.set("offset", String(offset));
  const res = await apiFetch(`${API}/me/saved-posts?${params}`, { credentials: "include", cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && typeof data === "object" && data !== null && "message" in data && typeof (data as { message?: unknown }).message === "string"
      ? (data as { message: string }).message
      : "Не удалось загрузить сохранённое";
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : [];
}

export async function sharePostToUser(postId: string, toUserId: string): Promise<{ chatId: string }> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(postId)}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ toUserId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message ?? "Не удалось отправить пост");
  return body;
}

import { formatDateShortLocal } from "@/lib/timezone";

export function formatPostTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  const h = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (min < 1) return "Только что";
  if (min < 60) return `${min} мин назад`;
  if (h < 24) return `${h} ч назад`;
  if (days === 1) return "Вчера";
  if (days < 7) return `${days} дн назад`;
  return formatDateShortLocal(d);
}
