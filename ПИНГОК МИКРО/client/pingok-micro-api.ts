import { API, apiFetch } from "@/lib/api-base";
import type { AiMemorySearchPayloadV1 } from "@/lib/ai-chat";

export type PingokExecuteCandidate = {
  id: string;
  displayName: string | null;
  surname: string | null;
};

export type PingokExecuteResponse =
  | {
      ok: true;
      reply: string;
      reminderId?: string;
      taskId?: string;
      chatId?: string;
      callMode?: "audio" | "video";
      targetUserId?: string;
      targetDisplayName?: string;
    }
  | {
      ok: false;
      reply: string;
      code?:
        | "need_time"
        | "pick_user"
        | "parse_message"
        | "confirm_user"
        | "confirm_call_user"
        | "pick_call_user"
        | "pick_schedule_call_peer";
      candidates?: PingokExecuteCandidate[];
      pendingMessage?: string;
      pendingCallMode?: "audio" | "video";
      pendingScheduleFireAt?: string;
      pendingScheduleReminderTitle?: string;
    };

export async function pingokMicroExecute(text: string): Promise<PingokExecuteResponse> {
  const res = await apiFetch(`${API}/pingok-micro/v1/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as PingokExecuteResponse & { message?: string };
  if (!res.ok) {
    return { ok: false, reply: typeof data.message === "string" ? data.message : "Ошибка исполнения" };
  }
  if (data && typeof data.ok === "boolean") {
    return data as PingokExecuteResponse;
  }
  return { ok: false, reply: "Некорректный ответ сервера" };
}

export async function pingokMicroSendDm(targetUserId: string, text: string): Promise<PingokExecuteResponse> {
  const res = await apiFetch(`${API}/pingok-micro/v1/send-dm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId, text }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as PingokExecuteResponse & { message?: string };
  if (!res.ok) {
    return { ok: false, reply: typeof data.message === "string" ? data.message : "Ошибка отправки" };
  }
  if (data && typeof data.ok === "boolean") {
    return data as PingokExecuteResponse;
  }
  return { ok: false, reply: "Некорректный ответ сервера" };
}

export async function pingokMicroConfirmScheduleCall(
  targetUserId: string,
  fireAtIso: string,
  reminderTitle: string,
): Promise<PingokExecuteResponse> {
  const res = await apiFetch(`${API}/pingok-micro/v1/confirm-schedule-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId, fireAtIso, reminderTitle }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as PingokExecuteResponse & { message?: string };
  if (!res.ok) {
    return { ok: false, reply: typeof data.message === "string" ? data.message : "Ошибка планирования" };
  }
  if (data && typeof data.ok === "boolean") {
    return data as PingokExecuteResponse;
  }
  return { ok: false, reply: "Некорректный ответ сервера" };
}

export async function pingokMicroStartCall(
  targetUserId: string,
  mode: "audio" | "video",
): Promise<PingokExecuteResponse> {
  const res = await apiFetch(`${API}/pingok-micro/v1/start-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetUserId, mode }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as PingokExecuteResponse & { message?: string };
  if (!res.ok) {
    return { ok: false, reply: typeof data.message === "string" ? data.message : "Ошибка запуска звонка" };
  }
  if (data && typeof data.ok === "boolean") {
    return data as PingokExecuteResponse;
  }
  return { ok: false, reply: "Некорректный ответ сервера" };
}

export type PingokMemorySearchResponse =
  | { matched: true; summary: string; payload: AiMemorySearchPayloadV1 }
  | { matched: false; hint: string };

export async function pingokMicroMemorySearch(query: string): Promise<PingokMemorySearchResponse> {
  const res = await apiFetch(`${API}/pingok-micro/v1/memory-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    suppressSessionExpireOn401: true,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : "Ошибка поиска");
  }
  if (data.matched === true && typeof data.summary === "string" && data.payload && typeof data.payload === "object") {
    return { matched: true, summary: data.summary, payload: data.payload as AiMemorySearchPayloadV1 };
  }
  if (data.matched === false && typeof data.hint === "string") {
    return { matched: false, hint: data.hint };
  }
  throw new Error("Некорректный ответ поиска");
}
