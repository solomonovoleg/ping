import { API, apiFetch, messageForFetchFailure } from "@/lib/api-base";

function readApiMessage(data: unknown): string | null {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  return null;
}

export async function fetchPasswordResetConfig(): Promise<{ passwordResetViaCallEnabled: boolean }> {
  try {
    const res = await apiFetch(`${API}/auth/password-reset/config`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      suppressSessionExpireOn401: true,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(readApiMessage(data) ?? "Не удалось загрузить настройки");
    }
    const d = data as { passwordResetViaCallEnabled?: unknown };
    return { passwordResetViaCallEnabled: d.passwordResetViaCallEnabled === true };
  } catch (e) {
    throw new Error(messageForFetchFailure(e));
  }
}

export type StartPasswordResetCallResult =
  | { ok: true; challengeId: string; expiresAt: string; confirmationNumber: string; qrCodeUri: string | null }
  | { ok: false; message: string };

export async function startPasswordResetCall(phone: string): Promise<StartPasswordResetCallResult> {
  try {
    const res = await apiFetch(`${API}/auth/password-reset/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone }),
      suppressSessionExpireOn401: true,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(readApiMessage(data) ?? "Не удалось начать сброс пароля");
    }
    const d = data as {
      challengeId?: unknown;
      expiresAt?: unknown;
      confirmationNumber?: unknown;
      qrCodeUri?: unknown;
      message?: unknown;
    };
    const challengeId = typeof d.challengeId === "string" ? d.challengeId.trim() : "";
    const expiresAt = typeof d.expiresAt === "string" ? d.expiresAt.trim() : "";
    const confirmationNumber =
      typeof d.confirmationNumber === "string" ? d.confirmationNumber.trim() : "";
    const qrRaw = typeof d.qrCodeUri === "string" ? d.qrCodeUri.trim() : "";
    if (challengeId && expiresAt && confirmationNumber) {
      return {
        ok: true,
        challengeId,
        expiresAt,
        confirmationNumber,
        qrCodeUri: qrRaw || null,
      };
    }
    const msg =
      typeof d.message === "string" && d.message.trim()
        ? d.message.trim()
        : "Если аккаунт с таким номером есть, вам позвонят. Иначе звонок не инициируется.";
    return { ok: false, message: msg };
  } catch (e) {
    if (e instanceof Error && e.message && !/связаться с сервером|интернет/i.test(e.message)) {
      throw e;
    }
    throw new Error(messageForFetchFailure(e));
  }
}

export async function fetchPasswordResetPollStatus(
  challengeId: string,
  phone: string,
): Promise<{ verified: boolean }> {
  try {
    const res = await apiFetch(`${API}/auth/password-reset/poll-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ challengeId, phone }),
      suppressSessionExpireOn401: true,
    });
    const data = (await res.json().catch(() => ({}))) as { verified?: unknown };
    if (!res.ok) return { verified: false };
    return { verified: data.verified === true };
  } catch {
    return { verified: false };
  }
}

export async function confirmPasswordResetCall(
  challengeId: string,
  phone: string,
  pin = "",
): Promise<{ resetTicket: string }> {
  try {
    const res = await apiFetch(`${API}/auth/password-reset/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ challengeId, phone, pin }),
      suppressSessionExpireOn401: true,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(readApiMessage(data) ?? "Не удалось подтвердить номер");
    }
    return data as { resetTicket: string };
  } catch (e) {
    if (e instanceof Error && e.message && !/связаться с сервером|интернет/i.test(e.message)) {
      throw e;
    }
    throw new Error(messageForFetchFailure(e));
  }
}

export async function completePasswordReset(phone: string, resetTicket: string, newPassword: string): Promise<void> {
  try {
    const res = await apiFetch(`${API}/auth/password-reset/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ phone, resetTicket, newPassword }),
      suppressSessionExpireOn401: true,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(readApiMessage(data) ?? "Не удалось сохранить пароль");
    }
  } catch (e) {
    if (e instanceof Error && e.message && !/связаться с сервером|интернет/i.test(e.message)) {
      throw e;
    }
    throw new Error(messageForFetchFailure(e));
  }
}
