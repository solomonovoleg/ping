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

export type EdgeLifeSimQueueItem = {
  id: string;
  kind: "feed" | "toilet" | "play" | "calm";
  spawnedAt: string;
  respondUntilAt: string;
  penalized: boolean;
  overdue: boolean;
};

/** Рейтинг жизни и очередь запросов (`companion.lifeSimulation` в кампании). */
export type EdgeLifeSimulationState =
  | {
      enabled: true;
      lifeRating: number;
      lifeMin: number;
      lifeMax: number;
      needQueue: EdgeLifeSimQueueItem[];
    }
  | { enabled: false };

/** Начисление за задание (как в EDGE `taskGrants`). */
export type EdgeTaskGrant = {
  taskKey: string;
  refKey: string;
  xpAwarded: number;
  createdAt: string;
};

/** Строка прогресса по пресету — с сервера в `participant/state`. */
export type EdgeTaskProgressLine = {
  taskKey: string;
  scoreTarget: "primary" | "secondary";
  tracking: "edge" | "platform" | "honor";
  claimed: boolean;
  xpAwardedIfClaimed: number | null;
  current: number | null;
  target: number | null;
  ratio: number | null;
  satisfied: boolean;
  readyToClaim: boolean;
};

export type EdgeTaskQuestSummary = {
  presetTotal: number;
  objectiveTotal: number;
  completedObjective: number;
  edgeIncomplete: number;
  edgeReadyToClaim: number;
  platformOpen: number;
  blockedConfig: number;
};

const EMPTY_TASK_QUEST_SUMMARY: EdgeTaskQuestSummary = {
  presetTotal: 0,
  objectiveTotal: 0,
  completedObjective: 0,
  edgeIncomplete: 0,
  edgeReadyToClaim: 0,
  platformOpen: 0,
  blockedConfig: 0,
};

export type EdgeParticipantState = {
  edgeId: string;
  platformUserId: string;
  level: number;
  xp: number;
  /** Очки основного рейтинга (игра/персонаж). */
  primaryXp?: number;
  /** Очки дополнительного рейтинга (задания ленты и т.д.). */
  secondaryXp?: number;
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
  /** Сквозной счётчик тапов по персонажу (онбординг EDGE). */
  introTapCount?: number;
  /** Нет в старых ответах — считаем выключенным. */
  lifeSimulation?: EdgeLifeSimulationState;
  taskGrants?: EdgeTaskGrant[];
  taskProgress?: EdgeTaskProgressLine[];
  taskQuestSummary?: EdgeTaskQuestSummary;
};

function normalizeParticipantState(raw: EdgeParticipantState): EdgeParticipantState {
  const xp = raw.xp;
  return {
    ...raw,
    primaryXp: raw.primaryXp ?? xp,
    secondaryXp: raw.secondaryXp ?? 0,
    lifeSimulation: raw.lifeSimulation ?? { enabled: false },
    taskGrants: Array.isArray(raw.taskGrants) ? raw.taskGrants : [],
    taskProgress: Array.isArray(raw.taskProgress) ? raw.taskProgress : [],
    taskQuestSummary:
      raw.taskQuestSummary && typeof raw.taskQuestSummary === "object"
        ? {
            presetTotal: Number((raw.taskQuestSummary as EdgeTaskQuestSummary).presetTotal) || 0,
            objectiveTotal: Number((raw.taskQuestSummary as EdgeTaskQuestSummary).objectiveTotal) || 0,
            completedObjective:
              Number((raw.taskQuestSummary as EdgeTaskQuestSummary).completedObjective) || 0,
            edgeIncomplete: Number((raw.taskQuestSummary as EdgeTaskQuestSummary).edgeIncomplete) || 0,
            edgeReadyToClaim:
              Number((raw.taskQuestSummary as EdgeTaskQuestSummary).edgeReadyToClaim) || 0,
            platformOpen: Number((raw.taskQuestSummary as EdgeTaskQuestSummary).platformOpen) || 0,
            blockedConfig: Number((raw.taskQuestSummary as EdgeTaskQuestSummary).blockedConfig) || 0,
          }
        : { ...EMPTY_TASK_QUEST_SUMMARY },
  };
}

export type EdgeLeaderboardEntry = {
  rank: number;
  xp: number;
  level: number;
  careStreakDays: number;
  isMe: boolean;
  /** Имя для UI (платформа обогащает из профиля). */
  displayName?: string;
  avatarUrl?: string | null;
};

export type EdgeLeaderboardPayload = {
  edgeId: string;
  kind?: "primary" | "secondary";
  frozen?: boolean;
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
    | "verification_failed"
    | "leaderboard_frozen"
    | "honor_disabled";
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
    case "honor_task_disabled":
      return "Тип задания «без проверки» отключён: организатор должен задать реальное условие (пост, питомец, приглашения и т.д.).";
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
  inviteIssueMode?: "batch_min_count" | "single_per_request" | "one_multi_use";
  maxUses?: number;
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
      if (j.error === "preset_verification_failed") {
        const reason = (j as { reason?: string }).reason;
        if (reason === "not_enough_invites") {
          throw new Error("Сначала пригласите нужное число друзей по правилам задания.");
        }
        throw new Error("Условия задания ещё не выполнены. Проверьте прогресс и попробуйте снова.");
      }
      if (j.error === "invite_pack_failed") {
        throw new Error(
          typeof j.message === "string" && j.message.trim()
            ? j.message
            : "Не удалось выдать коды. Повторите позже.",
        );
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
    if (res.status === 429) {
      let sec = 5;
      try {
        const j = JSON.parse(text) as { retryAfterSec?: number; error?: string };
        if (typeof j.retryAfterSec === "number" && j.retryAfterSec > 0) sec = j.retryAfterSec;
      } catch {
        /* ignore */
      }
      throw new Error(`Слишком частые запросы награды. Повторите через ~${sec} сек.`);
    }
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
  const raw = (await res.json()) as EdgeTaskRewardResponse;
  return { ...raw, state: normalizeParticipantState(raw.state) };
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
  return normalizeParticipantState((await res.json()) as EdgeParticipantState);
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
  return normalizeParticipantState((await res.json()) as EdgeParticipantState);
}

function formatEdgeParticipantFetchError(res: Response, rawBody: string): string {
  const t = rawBody.trim();
  const lower = t.toLowerCase();
  if (res.status === 404 || lower === "not found" || lower.includes("<!doctype")) {
    return "Список участников сейчас не открывается. Обновите экран или зайдите позже.";
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

export async function fetchEdgeLeaderboard(
  edgeId: string,
  limit = 30,
  kind: "primary" | "secondary" = "primary",
): Promise<EdgeLeaderboardPayload> {
  const qs = new URLSearchParams({ edgeId: edgeId.trim(), limit: String(limit), kind });
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
        const j = (await res.json()) as {
          nextAvailableAt?: string;
          error?: string;
          retryAfterSec?: number;
        };
        if (j.error === "tap_rate_limited" && typeof j.retryAfterSec === "number" && j.retryAfterSec > 0) {
          msg =
            j.retryAfterSec <= 8
              ? "Слишком частые тапы. Подождите несколько секунд."
              : `Слишком много тапов подряд. Повторите примерно через ${j.retryAfterSec} сек.`;
        } else if (j.nextAvailableAt) {
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
  return normalizeParticipantState((await res.json()) as EdgeParticipantState);
}
