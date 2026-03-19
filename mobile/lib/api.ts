const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://pingos.ru";
const BASE = API_BASE.replace(/\/$/, "");
export const API = `${BASE}/api`;
export const UPLOADS_BASE = BASE;
/** For image/audio URLs from server: relative /uploads/... → full URL */
export function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${UPLOADS_BASE}${url}`;
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: "omit",
  });
}

/** Upload with FormData (no Content-Type — browser sets multipart boundary) */
export async function apiUpload(path: string, formData: FormData): Promise<Response> {
  const headers = new Headers();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  return fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: formData,
    credentials: "omit",
  });
}

export type AuthUser = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  gender: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
};

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch("/auth/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data?.id ? data : null;
}

export async function login(phone: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Неверный номер или пароль");
  const token = data.token ?? "";
  if (token) setAuthToken(token);
  const { token: _t, ...user } = data;
  return { user: user as AuthUser, token };
}

export async function register(
  phone: string,
  password: string,
  referralCode: string
): Promise<{ user: AuthUser; token: string }> {
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password, referralCode: referralCode.trim() || undefined }),
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Ошибка регистрации");
  const token = data.token ?? "";
  if (token) setAuthToken(token);
  const { token: _t, ...user } = data;
  return { user: user as AuthUser, token };
}

export async function logout(): Promise<void> {
  setAuthToken(null);
  await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
}

export type ChatItem = {
  id: string;
  type: string;
  name: string | null;
  createdAt: string;
  otherMemberAvatarUrl?: string | null;
};

export async function getChats(): Promise<ChatItem[]> {
  const res = await apiFetch("/chats");
  if (!res.ok) throw new Error("Не удалось загрузить чаты");
  return res.json();
}

export type ChatDetail = ChatItem & {
  otherMember?: {
    id: string;
    displayName: string | null;
    surname: string | null;
    avatarUrl: string | null;
    phone?: string | null;
    lastReadAt?: string | null;
    lastSeenAt?: string | null;
  } | null;
};

export async function getChat(id: string): Promise<ChatDetail> {
  const res = await apiFetch(`/chats/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("Чат не найден");
  return res.json();
}

export type Message = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: string;
  content: string;
  createdAt: string;
};

export async function getMessages(chatId: string): Promise<Message[]> {
  const res = await apiFetch(`/chats/${chatId}/messages`);
  if (!res.ok) throw new Error("Не удалось загрузить сообщения");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function sendMessage(chatId: string, content: string, type = "text"): Promise<Message> {
  const res = await apiFetch(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось отправить");
  }
  return res.json();
}

/** Передавай messageId последнего видимого сообщения — иначе сервер не двигает lastReadAt (корректные галочки). */
export async function markChatRead(chatId: string, messageId?: string): Promise<void> {
  if (!messageId) return;
  await apiFetch(`/chats/${chatId}/read`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId }),
  });
}

export async function registerPushToken(token: string): Promise<void> {
  await apiFetch("/users/me/push-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// ——— Uploads (FormData, file from { uri, name, type }) ———
export async function uploadVoice(file: { uri: string; name?: string; type?: string }): Promise<string> {
  const form = new FormData();
  form.append("audio", file as unknown as Blob);
  const res = await apiUpload("/upload/voice", form);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось загрузить голосовое");
  return data.url as string;
}

export async function uploadChatMedia(file: { uri: string; name?: string; type?: string }): Promise<string> {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  const res = await apiUpload("/upload/chat-media", form);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось загрузить файл");
  return data.url as string;
}

export async function uploadPostMedia(file: { uri: string; name?: string; type?: string }): Promise<string> {
  const form = new FormData();
  form.append("file", file as unknown as Blob);
  const res = await apiUpload("/upload/post-media", form);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось загрузить файл");
  return data.url as string;
}

// ——— Posts ———
export type FeedPost = {
  id: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  reactions: { emoji: string; count: number }[];
  myReaction: string | null;
  createdAt: string;
  channelName: string;
  author: { id: string; publicId: number; displayName: string | null; surname: string | null; avatarUrl: string | null };
  commentsCount: number;
};

export async function fetchFeed(limit?: number): Promise<FeedPost[]> {
  const q = limit != null ? `?limit=${limit}` : "";
  const res = await apiFetch(`/posts${q}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchPostsByAuthor(authorId: string, limit?: number): Promise<FeedPost[]> {
  const q = limit != null ? `&limit=${limit}` : "";
  const res = await apiFetch(`/posts?authorId=${encodeURIComponent(authorId)}${q}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createPost(payload: { text: string; imageUrl?: string | null }): Promise<{ id: string; createdAt: string }> {
  const res = await apiFetch("/posts", {
    method: "POST",
    body: JSON.stringify({ text: payload.text.trim(), imageUrl: payload.imageUrl ?? null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось опубликовать");
  return { id: data.id, createdAt: data.createdAt ?? new Date().toISOString() };
}

export async function addReaction(postId: string, emoji: string): Promise<void> {
  const res = await apiFetch(`/posts/${encodeURIComponent(postId)}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "Не удалось поставить реакцию");
  }
}

export async function removeReaction(postId: string): Promise<void> {
  const res = await apiFetch(`/posts/${encodeURIComponent(postId)}/reactions`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.message as string) || "Не удалось убрать реакцию");
  }
}

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
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

// ——— Profile ———
export type PublicProfile = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  gender: string | null;
  avatarUrl: string | null;
  hideFromSearch: boolean;
  canMessage: boolean;
  isMe: boolean;
  postsCount: number;
  reactionsCount: number;
  commentsCount: number;
};

export async function fetchUserProfile(id: string): Promise<PublicProfile | null> {
  const res = await apiFetch(`/users/profile/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Не удалось загрузить профиль");
  return res.json();
}

export async function updateProfile(data: {
  displayName?: string;
  surname?: string;
  gender?: string;
  birthDate?: string;
  avatarUrl?: string;
}): Promise<AuthUser> {
  const res = await apiFetch("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err.message as string) || "Ошибка обновления профиля");
  }
  return res.json();
}

// ——— Comments ———
export type CommentItem = {
  id: string;
  postId: string;
  userId?: string;
  text: string;
  createdAt: string;
  user: string;
  avatar: string | null;
  likes: number;
};

export async function fetchComments(postId: string): Promise<CommentItem[]> {
  const res = await apiFetch(`/posts/${encodeURIComponent(postId)}/comments`);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ""),
    postId: String(c.postId ?? postId),
    userId: typeof c.userId === "string" ? c.userId : undefined,
    text: String(c.text ?? ""),
    createdAt: String(c.createdAt ?? ""),
    user: String(c.user ?? "Пользователь"),
    avatar: typeof c.avatar === "string" ? c.avatar : null,
    likes: typeof c.likes === "number" ? c.likes : 0,
  }));
}

export async function createComment(postId: string, text: string): Promise<CommentItem | null> {
  const res = await apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ text: text.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось отправить комментарий");
  return {
    id: String(data.id ?? ""),
    postId: String(data.postId ?? postId),
    userId: typeof data.userId === "string" ? data.userId : undefined,
    text: String(data.text ?? ""),
    createdAt: String(data.createdAt ?? ""),
    user: String(data.user ?? "Пользователь"),
    avatar: typeof data.avatar === "string" ? data.avatar : null,
    likes: 0,
  };
}

export function formatCommentTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} д`;
  return d.toLocaleDateString();
}
