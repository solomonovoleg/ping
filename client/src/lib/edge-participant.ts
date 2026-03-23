import { API, apiFetch } from "@/lib/api-base";

/** Счётчики скриптов заданий (UTC-день + серия заходов в компаньон). */
export type EdgeGameScriptMetrics = {
  gameDailyYmd: string;
  gameLoginStreakDays: number;
  dailyTapCount: number;
  dailyFeedCount: number;
  dailyPlayCount: number;
  dailyToiletCount: number;
  dailyCalmCount: number;
  dailyPetCount: number;
};

export type EdgeParticipantState = {
  edgeId: string;
  platformUserId: string;
  level: number;
  xp: number;
  mood: string;
  happyScore: number;
  careStreakDays: number;
  lastFedAt: string | null;
  lastInteractionAt: string | null;
  joinedAt: string;
  /** Следующий «идеальный» момент кормления; null — пора кормить или нет данных. */
  careDeadlineAt: string | null;
  gameScriptMetrics?: EdgeGameScriptMetrics;
  petNeeds?: {
    hunger: number;
    hygiene: number;
    energy: number;
    comfort: number;
  };
  activeNeed?: "hungry" | "dirty" | "bored" | "anxious" | null;
  recommendedAction?: "feed" | "toilet" | "play" | "calm" | "pet" | "tap" | null;
  actionProgress?: {
    feed: number;
    toilet: number;
    play: number;
    target: number;
  };
};

export type EdgeLeaderboardEntry = {
  rank: number;
  xp: number;
  level: number;
  careStreakDays: number;
  isMe: boolean;
};

export type EdgeLeaderboardPayload = {
  edgeId: string;
  entries: EdgeLeaderboardEntry[];
  totalParticipants: number;
  myRank: number | null;
};

export class EdgeInteractCooldownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdgeInteractCooldownError";
  }
}

export class EdgeCampaignLockedError extends Error {
  constructor() {
    super("Кампания завершена или на паузе — действия с персонажем недоступны.");
    this.name = "EdgeCampaignLockedError";
  }
}

export type EdgeTaskRewardResponse = {
  awarded: boolean;
  xpDelta: number;
  taskKey: string;
  state: EdgeParticipantState;
  denyReason?:
    | "already_claimed"
    | "campaign_locked"
    | "not_published"
    | "deadline_passed"
    | "invalid_preset"
    | "verification_failed";
};

export class EdgePresetVerificationError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(presetVerificationMessageRu(reason));
    this.name = "EdgePresetVerificationError";
    this.reason = reason;
  }
}

function presetVerificationMessageRu(reason: string): string {
  switch (reason) {
    case "creator_unknown":
      return "Кампания без привязки к автору — проверка подписки недоступна.";
    case "not_following_creator":
      return "Сначала подпишитесь на автора кампании.";
    case "post_not_found":
      return "Пост для задания не найден.";
    case "post_not_in_campaign":
      return "Этот пост не относится к этой кампании EDGE.";
    case "no_reaction":
      return "Поставьте реакцию на указанный пост.";
    case "not_enough_comments":
      return "Нужен комментарий к указанному посту.";
    case "not_enough_invites":
      return "Нужно больше приглашённых по вашей реферальной ссылке.";
    case "not_enough_posts":
      return "Нужно больше опубликованных постов.";
    case "profile_incomplete":
      return "Заполните в профиле дату рождения, пол и аватар.";
    case "not_enough_comments_global":
      return "Нужно больше комментариев к постам в PING.";
    case "not_enough_reactions_global":
      return "Нужно больше реакций на посты в PING.";
    case "user_not_found":
      return "Профиль не найден.";
    default:
      return "Условие задания ещё не выполнено.";
  }
}

const PRESET_TASK_REF = "preset_once";

/** Начисление XP по пресет-ключу из конфига (`taskPresets`), ref фиксированный для one-shot. */
export type PingInvitePackResult = {
  ok: true;
  chatId: string;
  codesCount: number;
  hint?: string;
};

export async function postEdgePingInvitePack(edgeId: string, taskKey: string): Promise<PingInvitePackResult> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim() });
  const res = await apiFetch(`${API}/edge/participant/ping-invite-pack?${qs}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskKey: taskKey.trim() }),
  });
  const text = (await res.text()) || res.statusText;
  if (res.status === 429) {
    let s = 45;
    try {
      const j = JSON.parse(text) as { retryAfterSec?: number };
      if (typeof j.retryAfterSec === "number") s = j.retryAfterSec;
    } catch {
      /* ignore */
    }
    throw new Error(`Подождите ${s} сек. перед повторным запросом кодов.`);
  }
  if (!res.ok) {
    try {
      const j = JSON.parse(text) as { error?: string; message?: string };
      if (j.error === "campaign_creator_unknown") {
        throw new Error("У кампании не указан создатель — коды недоступны.");
      }
      if (j.error === "task_not_ping_invite") {
        throw new Error("Это задание не про приглашения в PING.");
      }
      if (j.error === "dm_failed") {
        throw new Error(typeof j.message === "string" && j.message.trim() ? j.message : "Не удалось отправить ЛС.");
      }
      if (j.error === "edge_companion_unavailable" || j.error === "edge_companion_invalid") {
        throw new Error("Конфиг кампании временно недоступен. Повторите позже.");
      }
      throw new Error(typeof j.message === "string" ? j.message : text || `${res.status}`);
    } catch (e) {
      if (e instanceof Error && e.message !== "[object Object]") throw e;
    }
    throw new Error(text || `${res.status}`);
  }
  const data = JSON.parse(text) as PingInvitePackResult;
  if (!data.chatId) throw new Error("Сервер не вернул чат");
  return data;
}

export async function postEdgeParticipantTask(
  edgeId: string,
  taskKey: string,
  ref: string = PRESET_TASK_REF,
): Promise<EdgeTaskRewardResponse> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim() });
  const res = await apiFetch(`${API}/edge/participant/task?${qs}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskKey: taskKey.trim(), ref: ref.trim() || PRESET_TASK_REF }),
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    if (res.status === 403) {
      try {
        const j = JSON.parse(text) as { error?: string; reason?: string };
        if (j.error === "preset_verification_failed" && typeof j.reason === "string") {
          throw new EdgePresetVerificationError(j.reason);
        }
      } catch (e) {
        if (e instanceof EdgePresetVerificationError) throw e;
      }
    }
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeTaskRewardResponse;
}

export async function fetchEdgeParticipantState(edgeId: string): Promise<EdgeParticipantState> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim() });
  const res = await apiFetch(`${API}/edge/participant/state?${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeParticipantState;
}

export async function postEdgeParticipantFeed(edgeId: string): Promise<EdgeParticipantState> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim() });
  const res = await apiFetch(`${API}/edge/participant/feed?${qs}`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 403) {
      try {
        const j = JSON.parse(errBody) as { error?: string };
        if (j.error === "edge_campaign_locked") throw new EdgeCampaignLockedError();
      } catch (e) {
        if (e instanceof EdgeCampaignLockedError) throw e;
      }
      throw new Error(errBody || "Доступ запрещён");
    }
    throw new Error(errBody || res.statusText || `${res.status}`);
  }
  return (await res.json()) as EdgeParticipantState;
}

function formatEdgeParticipantFetchError(res: Response, rawBody: string): string {
  const t = rawBody.trim();
  const lower = t.toLowerCase();
  if (res.status === 404 || lower === "not found" || lower.includes("<!doctype")) {
    return "Лидерборд не отвечает. Обновите страницу; если так и будет — напишите в поддержку.";
  }
  try {
    const j = JSON.parse(t) as { error?: string; message?: string };
    if (j.error === "edge_participant_unavailable") {
      return "Сервис кампании временно недоступен. Попробуйте через минуту.";
    }
    if (j.error === "edge_upstream_not_configured") {
      return "Кампании на сервере сейчас отключены.";
    }
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
  } catch {
    /* not json */
  }
  if (t.length > 0 && t.length < 240) return t;
  return res.statusText || `Ошибка ${res.status}`;
}

export async function fetchEdgeLeaderboard(edgeId: string, limit = 30): Promise<EdgeLeaderboardPayload> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim(), limit: String(limit) });
  const res = await apiFetch(`${API}/edge/participant/leaderboard?${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatEdgeParticipantFetchError(res, text));
  }
  return (await res.json()) as EdgeLeaderboardPayload;
}

export type EdgeInteractKind = "play" | "pet" | "toilet" | "calm" | "tap";

export async function postEdgeParticipantInteract(
  edgeId: string,
  kind: EdgeInteractKind,
): Promise<EdgeParticipantState> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim() });
  const res = await apiFetch(`${API}/edge/participant/interact?${qs}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  if (!res.ok) {
    if (res.status === 429) {
      let msg = "Подождите, действие ещё на перезарядке.";
      try {
        const j = (await res.json()) as { nextAvailableAt?: string };
        if (j.nextAvailableAt) {
          const t = new Date(j.nextAvailableAt);
          if (!Number.isNaN(t.getTime())) {
            msg = `Снова можно после ${t.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
          }
        }
      } catch {
        /* ignore */
      }
      throw new EdgeInteractCooldownError(msg);
    }
    if (res.status === 403) {
      const errBody = await res.text();
      try {
        const j = JSON.parse(errBody) as { error?: string };
        if (j.error === "edge_campaign_locked") throw new EdgeCampaignLockedError();
      } catch (e) {
        if (e instanceof EdgeCampaignLockedError) throw e;
      }
      throw new Error(errBody || "Доступ запрещён");
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeParticipantState;
}
