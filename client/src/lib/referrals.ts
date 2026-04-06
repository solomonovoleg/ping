import { API, apiFetch } from "@/lib/api-base";

export type ReferralCheckResult =
  | { valid: true; inviterName: string; expiresAt: string }
  | { valid: false; message: string };

/** Проверка кода без авторизации (на экране регистрации). */
export async function checkReferralCode(code: string): Promise<ReferralCheckResult> {
  const res = await fetch(`${API}/referrals/check?code=${encodeURIComponent(code)}`, {
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (data.valid === true) {
    return { valid: true, inviterName: data.inviterName ?? "", expiresAt: data.expiresAt ?? "" };
  }
  return { valid: false, message: (data.message as string) || "Код недействителен" };
}

export type MyCodesResponse = {
  codes: { id: string; code: string; expiresAt: string }[];
  usedCount: number;
  limit: number;
  remaining: number;
  autoGrant?: {
    repeatEnabled: boolean;
    repeatInvites: number;
    repeatAfterHours: number;
    firstLimitReachedAt: string | null;
    bonusGrantedAt: string | null;
    nextGrantAt: string | null;
  };
};

/** Мои пригласительные коды (в настройках). В нативном приложении нужен apiFetch для Bearer. */
export async function getMyReferralCodes(): Promise<MyCodesResponse> {
  const res = await apiFetch(`${API}/referrals/my-codes`);
  if (!res.ok) throw new Error("Не удалось загрузить коды");
  return res.json();
}

export async function createReferralCode(): Promise<{
  id: string;
  code: string;
  expiresAt: string;
  expiresInHours: number;
}> {
  const res = await apiFetch(`${API}/referrals/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.message as string) || "Не удалось создать приглашение");
  return data;
}

export type InvitedUser = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
};

export async function getInvitedUsers(): Promise<InvitedUser[]> {
  const res = await apiFetch(`${API}/referrals/invited`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((u: Record<string, unknown>) => ({
    id: String(u.id ?? ""),
    publicId: typeof u.publicId === "number" ? u.publicId : 0,
    displayName: typeof u.displayName === "string" ? u.displayName : null,
    surname: typeof u.surname === "string" ? u.surname : null,
    avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl : null,
    createdAt: typeof u.createdAt === "string" ? u.createdAt : null,
  }));
}

/** Нормализация ввода кода: для 4 цифр — только цифры; для фраз — пробелы/дефисы и нижний регистр */
export function normalizeReferralCodeInput(input: string): string {
  const trimmed = input.trim();
  const onlyDigits = trimmed.replace(/\D/g, "");
  if (onlyDigits.length === 4) return onlyDigits;
  return trimmed
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
