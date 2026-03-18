import { API, apiFetch, getAuthHeaders, setAuthToken } from "@/lib/api-base";

export type AuthUser = {
  id: string;
  publicId: number;
  phone: string;
  displayName: string | null;
  surname: string | null;
  gender: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  profileLink?: string | null;
  platformRole?: string;
  hideFromSearch?: boolean;
  bio?: string | null;
  /** Включены ли пуш-уведомления о новых сообщениях */
  pushEnabled?: boolean;
};

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API}/auth/me`, {
    credentials: "include",
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json().catch(() => ({}));
  if (!data || typeof data.id !== "string" || typeof data.phone !== "string") {
    return null;
  }
  return {
    id: data.id,
    publicId: typeof data.publicId === "number" ? data.publicId : 100,
    phone: data.phone,
    displayName: data.displayName ?? null,
    surname: data.surname ?? null,
    gender: data.gender ?? null,
    birthDate: data.birthDate ?? null,
    avatarUrl: data.avatarUrl ?? null,
    coverUrl: data.coverUrl ?? null,
    profileLink: data.profileLink ?? null,
    platformRole: data.platformRole ?? "user",
    hideFromSearch: data.hideFromSearch ?? false,
    bio: data.bio ?? null,
    pushEnabled: data.pushEnabled !== false,
  };
}

export async function login(phone: string, password: string): Promise<AuthUser & { token?: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    credentials: "include",
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ||
        (res.status === 401 ? "Неверный номер или пароль" : "Ошибка входа")
    );
  }
  setAuthToken(data?.token ?? null);
  return data as AuthUser & { token?: string };
}

export async function register(
  phone: string,
  password: string,
  referralCode?: string
): Promise<AuthUser> {
  const body: { phone: string; password: string; referralCode?: string } = { phone, password };
  if (referralCode?.trim()) body.referralCode = referralCode.trim();
  const res = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data && data.message) || "Ошибка регистрации");
  }
  const data = await res.json().catch(() => null);
  if (!data || typeof data !== "object") {
    setAuthToken(null);
    throw new Error("Неверный ответ сервера при регистрации");
  }
  const token = data.token != null ? String(data.token) : null;
  setAuthToken(token);
  const user = data.user ?? data;
  const out: AuthUser & { token?: string } = {
    id: String(user?.id ?? ""),
    publicId: typeof user?.publicId === "number" ? user.publicId : 0,
    phone: String(user?.phone ?? phone),
    displayName: typeof user?.displayName === "string" ? user.displayName : null,
    surname: typeof user?.surname === "string" ? user.surname : null,
    avatarUrl: typeof user?.avatarUrl === "string" ? user.avatarUrl : null,
    gender: typeof user?.gender === "string" ? user.gender : null,
    birthDate: typeof user?.birthDate === "string" ? user.birthDate : null,
  };
  if (token) out.token = token;
  return out;
}

export async function logout(): Promise<void> {
  await fetch(`${API}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
  });
  setAuthToken(null);
}

/** Удаление своего аккаунта (требование App Store). После успеха нужно вызвать logout и перенаправить на вход. */
export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API}/auth/me`, {
    method: "DELETE",
    credentials: "include",
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) || "Не удалось удалить аккаунт"
    );
  }
  setAuthToken(null);
}

/** Загружает аватар (data URL или Blob), возвращает URL картинки с сервера */
export async function uploadAvatar(dataUrlOrBlob: string | Blob): Promise<string> {
  let file: Blob;
  if (typeof dataUrlOrBlob === "string") {
    const res = await fetch(dataUrlOrBlob);
    file = await res.blob();
  } else {
    file = dataUrlOrBlob;
  }
  const type = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  const form = new FormData();
  form.append("file", file instanceof File ? file : new File([file], "avatar.jpg", { type }), "avatar.jpg");
  const res = await fetch(`${API}/upload/avatar`, {
    method: "POST",
    credentials: "include",
    headers: getAuthHeaders(),
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка загрузки аватара";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const data = JSON.parse(text) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL аватара");
    return data.url;
  } catch {
    throw new Error("Неверный ответ сервера при загрузке аватара");
  }
}

/** Загрузить шапку профиля (баннер). Возвращает URL для сохранения в coverUrl. */
export async function uploadCover(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "cover.jpg");
  const res = await apiFetch(`${API}/upload/cover`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка загрузки шапки";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    const data = JSON.parse(text) as { url?: string };
    if (typeof data?.url !== "string") throw new Error("Сервер не вернул URL шапки");
    return data.url;
  } catch {
    throw new Error("Неверный ответ сервера при загрузке шапки");
  }
}

export async function updateProfile(data: {
  displayName?: string;
  surname?: string;
  gender?: string;
  birthDate?: string | null;
  avatarUrl?: string;
  hideFromSearch?: boolean;
  bio?: string | null;
  coverUrl?: string | null;
  profileLink?: string | null;
  pushEnabled?: boolean;
}): Promise<AuthUser> {
  const res = await fetch(`${API}/users/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    credentials: "include",
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) {
    let message = "Ошибка обновления профиля";
    try {
      const err = JSON.parse(text) as { message?: string };
      if (err?.message) message = err.message;
    } catch {
      if (text) message = text.slice(0, 200);
    }
    throw new Error(message);
  }
  try {
    return JSON.parse(text) as AuthUser;
  } catch {
    throw new Error("Неверный ответ сервера");
  }
}
