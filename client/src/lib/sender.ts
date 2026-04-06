import { API, apiFetch } from "@/lib/api-base";

export type SenderWelcomeResponse = {
  moduleEnabled: boolean;
  autoSendOnFollow: boolean;
  welcomeText: string;
  welcomeMediaUrl: string | null;
  stats: {
    followersCount: number;
    welcomesDeliveredCount: number;
  };
};

export async function fetchSenderWelcome(): Promise<SenderWelcomeResponse> {
  const res = await apiFetch(`${API}/sender/welcome`, { credentials: "include", cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Не удалось загрузить SENDER");
  }
  return body as SenderWelcomeResponse;
}

export type PatchSenderWelcomeBody = {
  moduleEnabled?: boolean;
  autoSendOnFollow?: boolean;
  welcomeText?: string;
  welcomeMediaUrl?: string | null;
};

export async function patchSenderWelcome(patch: PatchSenderWelcomeBody): Promise<SenderWelcomeResponse> {
  const res = await apiFetch(`${API}/sender/welcome`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(patch),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof body.message === "string" ? body.message : "Не удалось сохранить");
  }
  return body as SenderWelcomeResponse;
}
