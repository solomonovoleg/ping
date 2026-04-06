import { API, apiFetch } from "@/lib/api-base";
import type { CompanionUiPayload } from "@/features/edge-companion/companion-surfaces/types";
import type { PresetVerify } from "@shared/edge-task-preset-config";

/** Пресет задания из конструктора EDGE (ключ = `taskKey` в POST task). */
export type EdgeTaskPresetPublic = {
  key: string;
  label: string;
  points: number;
  penalty: number;
  deadlineDays: number;
  /** Раздел конструктора; у старых ответов может не быть — тогда считаем primary. */
  scope?: "game" | "global" | "commercial";
  scoreTarget?: "primary" | "secondary";
  /** Если нет в старых ответах — считается `honor`. */
  verify?: PresetVerify;
};

export type ResultsLiveWinnerPayload = {
  platformUserId: string;
  giftKey: string;
  giftLabel: string;
  anonLabel: string;
};

export type ResultsLivePayload = {
  drawBatchId: string;
  drawnAt: string;
  winners: ResultsLiveWinnerPayload[];
};

/** Шаблон ЛС с кодами для задания «пригласить друзей». */
export type PingInviteDmConfig = {
  template: string;
  codeExpiresInHours: number;
  inviteIssueMode?: "batch_min_count" | "single_per_request" | "one_multi_use";
  multiUseRegistrations?: number;
};

/** Настройки «рейтинга жизни» из EDGE (`companion.lifeSimulation`). */
export type EdgeLifeSimulationConfig = {
  enabled: boolean;
  lifeMin: number;
  lifeMax: number;
  lifeInitial: number;
  intervalHours: { feed: number; toilet: number; play: number; calm: number };
  responseWindowHours: number;
  onTimeBonus: number;
  missedPenalty: number;
  queueFulfillBonus: number;
  maxMoodBonus: number;
  maxQueuePerKind: number;
};

/** Конфиг кампании EDGE Companion (прокси с микросервиса EDGE). */
export type EdgeCompanionCampaignConfig = {
  status: "draft" | "published" | "paused" | "ended";
  title: string;
  gifts?: { templates?: unknown[] };
  leaderboard?: {
    globalEnabled?: boolean;
    primaryEnabled?: boolean;
    secondaryEnabled?: boolean;
    primaryFrozen?: boolean;
    secondaryFrozen?: boolean;
  };
  followReward?: { enabled?: boolean };
  edgeId?: string;
  /** character | roulette | catalog | … — с микросервиса EDGE */
  edgeType?: string;
  /** Порядок экранов и контент из `config_json.companion` (опционально у старых ответов). */
  companionUi?: CompanionUiPayload;
  /** Последний розыгрыш из БД EDGE (публично — маскированные подписи). */
  resultsLive?: ResultsLivePayload | null;
  scheduleEndsAt?: string | null;
  /** Сервер: нельзя кормить/играть (завершена, пауза, дата окончания). */
  interactLocked?: boolean;
  /** Создатель кампании (для проверки подписки и т.п.). */
  creatorPlatformUserId?: string | null;
  taskPresets?: EdgeTaskPresetPublic[];
  pingInviteDm?: PingInviteDmConfig;
  /** Кто видит пост с EDGE (с сервера; по умолчанию public). */
  displayAudience?: "self" | "followers" | "public";
  lifeSimulation?: EdgeLifeSimulationConfig;
};

export async function fetchEdgeCompanionCampaignConfig(edgeId: string): Promise<EdgeCompanionCampaignConfig> {
  const id = edgeId.trim();
  if (!id) {
    throw new Error("Не указан идентификатор кампании (edgeId).");
  }
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/companion/campaign-config?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeCompanionCampaignConfig;
}
