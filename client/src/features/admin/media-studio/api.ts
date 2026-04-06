import { API, apiFetch, postFormDataWithUploadProgress } from "@/lib/api-base";

function adminFetch(path: string, init?: RequestInit) {
  return apiFetch(`${API}${path}`, { ...init, credentials: "include" });
}

/** Текст ошибки из тела ответа (JSON `message` или сырая строка / обрезка HTML). */
function parseAdminErrorMessage(bodyText: string, fallback: string): string {
  const raw = (bodyText || "").trim();
  if (!raw) return fallback;
  try {
    const j = JSON.parse(raw) as { message?: string };
    if (j && typeof j.message === "string" && j.message.trim()) return j.message.trim();
  } catch {
    /* не JSON */
  }
  if (raw.startsWith("<")) {
    return fallback;
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}

async function throwUnlessOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  const t = await res.text();
  throw new Error(parseAdminErrorMessage(t, fallback));
}

export type StudioSyntheticUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  gender: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  city: string | null;
  status: string | null;
  nickname: string | null;
  profileLink: string | null;
  isStudioSynthetic?: boolean;
  studioCreatedByAdminId?: string | null;
  createdAt?: string | null;
  showCover?: boolean;
};

export type StudioSyntheticPostSummary = {
  id: string;
  text: string;
  createdAt: string;
  imageUrl: string | null;
};

export type StudioSyntheticUserDetail = {
  user: StudioSyntheticUser;
  profileViewsTotal: number;
  profileViewsUniqueViewers: number;
  postsCount: number;
  recentPosts: StudioSyntheticPostSummary[];
};

export async function fetchStudioSyntheticUsers(limit = 50, offset = 0): Promise<{
  users: StudioSyntheticUser[];
  total: number;
}> {
  const res = await adminFetch(`/admin/media-studio/synthetic-users?limit=${limit}&offset=${offset}`);
  await throwUnlessOk(res, "Не удалось загрузить список");
  return res.json() as Promise<{ users: StudioSyntheticUser[]; total: number }>;
}

export async function fetchStudioSyntheticUserDetail(id: string): Promise<StudioSyntheticUserDetail> {
  const res = await adminFetch(`/admin/media-studio/synthetic-users/${encodeURIComponent(id)}`);
  await throwUnlessOk(res, "Не удалось загрузить карточку");
  return res.json() as Promise<StudioSyntheticUserDetail>;
}

export async function createStudioSyntheticUser(body: {
  displayName: string;
  surname: string;
  gender: string;
  birthDate?: string | null;
}): Promise<{ user: StudioSyntheticUser }> {
  const payload: Record<string, unknown> = {
    displayName: body.displayName.trim(),
    surname: body.surname.trim(),
    gender: body.gender,
  };
  const bd = body.birthDate?.trim();
  if (bd) payload.birthDate = bd;

  const res = await adminFetch("/admin/media-studio/synthetic-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await throwUnlessOk(res, "Не удалось создать пользователя");
  return res.json() as Promise<{ user: StudioSyntheticUser }>;
}

export async function patchStudioSyntheticUser(
  id: string,
  body: Record<string, unknown>,
): Promise<{ user: StudioSyntheticUser }> {
  const res = await adminFetch(`/admin/media-studio/synthetic-users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwUnlessOk(res, "Не удалось сохранить профиль");
  return res.json() as Promise<{ user: StudioSyntheticUser }>;
}

async function postStudioMultipart(path: string, file: File): Promise<{ url: string; user: StudioSyntheticUser }> {
  const fd = new FormData();
  fd.append("file", file);
  const { ok, bodyText } = await postFormDataWithUploadProgress(`${API}${path}`, fd);
  if (!ok) {
    throw new Error(parseAdminErrorMessage(bodyText, "Ошибка загрузки"));
  }
  try {
    return JSON.parse(bodyText) as { url: string; user: StudioSyntheticUser };
  } catch {
    throw new Error("Некорректный ответ сервера после загрузки");
  }
}

export async function uploadStudioSyntheticAvatar(
  id: string,
  file: File,
): Promise<{ url: string; user: StudioSyntheticUser }> {
  return postStudioMultipart(`/admin/media-studio/synthetic-users/${encodeURIComponent(id)}/avatar`, file);
}

export async function uploadStudioSyntheticCover(
  id: string,
  file: File,
): Promise<{ url: string; user: StudioSyntheticUser }> {
  return postStudioMultipart(`/admin/media-studio/synthetic-users/${encodeURIComponent(id)}/cover`, file);
}

// --- Кампании публикаций (очередь от имени studio users) ---

export type MediaStudioCampaign = {
  id: string;
  createdByAdminId: string;
  title: string | null;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  scheduleMode: string | null;
  scheduleIntervalSecondsMin: number | null;
  scheduleIntervalSecondsMax: number | null;
  shuffleSeed: number | null;
  createdAt: string;
  updatedAt: string;
  /** Только в списке кампаний */
  queuedCount?: number;
};

export type MediaStudioCampaignPost = {
  id: string;
  campaignId: string;
  sortOrder: number;
  authorUserId: string | null;
  bodyText: string;
  mediaUrls: string[];
  scheduledAt: string | null;
  publishedPostId: string | null;
  state: "queued" | "published" | "failed" | "skipped";
  createdAt: string;
  updatedAt: string;
  /** Путь в приложении, если пост уже опубликован */
  publishedPath: string | null;
};

export async function fetchMediaStudioCampaigns(): Promise<{ campaigns: MediaStudioCampaign[] }> {
  const res = await adminFetch("/admin/media-studio/campaigns");
  await throwUnlessOk(res, "Не удалось загрузить кампании");
  return res.json() as Promise<{ campaigns: MediaStudioCampaign[] }>;
}

export async function createMediaStudioCampaign(body?: {
  title?: string | null;
}): Promise<{ campaign: MediaStudioCampaign }> {
  const res = await adminFetch("/admin/media-studio/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  await throwUnlessOk(res, "Не удалось создать кампанию");
  return res.json() as Promise<{ campaign: MediaStudioCampaign }>;
}

export async function fetchMediaStudioCampaignDetail(
  id: string,
): Promise<{ campaign: MediaStudioCampaign; posts: MediaStudioCampaignPost[] }> {
  const res = await adminFetch(`/admin/media-studio/campaigns/${encodeURIComponent(id)}`);
  await throwUnlessOk(res, "Не удалось загрузить кампанию");
  return res.json() as Promise<{ campaign: MediaStudioCampaign; posts: MediaStudioCampaignPost[] }>;
}

export async function patchMediaStudioCampaign(
  id: string,
  body: { status?: MediaStudioCampaign["status"]; title?: string | null },
): Promise<{ campaign: MediaStudioCampaign }> {
  const res = await adminFetch(`/admin/media-studio/campaigns/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwUnlessOk(res, "Не удалось сохранить кампанию");
  return res.json() as Promise<{ campaign: MediaStudioCampaign }>;
}

export async function addMediaStudioCampaignPost(
  campaignId: string,
  body: {
    authorUserId: string;
    bodyText?: string;
    mediaUrls?: string[];
    scheduledAt?: string | null;
  },
): Promise<{ post: MediaStudioCampaignPost }> {
  const res = await adminFetch(`/admin/media-studio/campaigns/${encodeURIComponent(campaignId)}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwUnlessOk(res, "Не удалось добавить в очередь");
  return res.json() as Promise<{ post: MediaStudioCampaignPost }>;
}

export async function deleteMediaStudioCampaignPost(
  campaignId: string,
  postId: string,
): Promise<void> {
  const res = await adminFetch(
    `/admin/media-studio/campaigns/${encodeURIComponent(campaignId)}/posts/${encodeURIComponent(postId)}`,
    { method: "DELETE" },
  );
  await throwUnlessOk(res, "Не удалось удалить из очереди");
}

export async function tickMediaStudioCampaign(id: string): Promise<{ published: number; failed: number }> {
  const res = await adminFetch(`/admin/media-studio/campaigns/${encodeURIComponent(id)}/tick`, {
    method: "POST",
  });
  await throwUnlessOk(res, "Не удалось обработать очередь");
  return res.json() as Promise<{ published: number; failed: number }>;
}

// --- Групповые чаты (вкладка Media Studio) ---

export type MediaStudioGroupChat = {
  id: string;
  type: string;
  name: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  inviteLink: string | null;
  memberCount: number;
  createdAt: string;
};

export type MediaStudioCreateGroupChatResult = {
  chat: {
    id: string;
    type: string;
    name: string | null;
    avatarUrl: string | null;
    shortCode: string | null;
    inviteCode: string;
    createdAt: string;
  };
  inviteLink: string;
  creator: {
    id: string;
    publicId: number;
    displayName: string | null;
  };
};

export async function createMediaStudioGroupChat(body: {
  creatorUserId: string;
  name?: string;
}): Promise<MediaStudioCreateGroupChatResult> {
  const res = await adminFetch("/admin/group-chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwUnlessOk(res, "Не удалось создать групповой чат");
  return res.json() as Promise<MediaStudioCreateGroupChatResult>;
}

export async function uploadMediaStudioGroupChatAvatar(chatId: string, file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const { ok, bodyText } = await postFormDataWithUploadProgress(
    `${API}/admin/group-chats/${encodeURIComponent(chatId)}/avatar`,
    fd,
  );
  if (!ok) {
    throw new Error(parseAdminErrorMessage(bodyText, "Не удалось загрузить аватар чата"));
  }
  try {
    return JSON.parse(bodyText) as { url: string };
  } catch {
    throw new Error("Некорректный ответ сервера после загрузки");
  }
}

export async function fetchMediaStudioGroupChats(): Promise<{ chats: MediaStudioGroupChat[] }> {
  const res = await adminFetch("/admin/group-chats");
  await throwUnlessOk(res, "Не удалось загрузить список групп");
  return res.json() as Promise<{ chats: MediaStudioGroupChat[] }>;
}
