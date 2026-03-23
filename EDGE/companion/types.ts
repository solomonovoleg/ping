import type { PresetVerify } from "../../shared/edge-task-preset-config.js";
import type { CompanionUiPayload } from "./campaign-ui-config.js";
import type { ResultsLivePayload } from "./build-results-live.js";

/** Пресеты заданий из конструктора (публично для Companion UI). */
export type EdgeTaskPresetPublic = {
  key: string;
  label: string;
  points: number;
  penalty: number;
  deadlineDays: number;
  /** Условие выдачи XP (проверка на платформе и/или в EDGE). */
  verify: PresetVerify;
};

/** Ответ совместим с `client/src/lib/edge-gamification.ts`. */
export type CompanionCampaignConfigPayload = {
  status: "draft" | "published" | "paused" | "ended";
  title: string;
  gifts: { templates: unknown[] };
  leaderboard: { globalEnabled: boolean };
  followReward: { enabled: boolean };
  edgeId: string;
  edgeType?: string;
  /** Порядок свайп-экранов и контент из `config_json.companion`. */
  companionUi: CompanionUiPayload;
  /** Последний зафиксированный розыгрыш из `edge_prize_winners`. */
  resultsLive: ResultsLivePayload | null;
  /** `config_json.schedule.endsAt` (ISO) или null. */
  scheduleEndsAt: string | null;
  /** Нельзя кормить / играть: draft, paused, ended или срок вышел. */
  interactLocked: boolean;
  /** Создатель кампании (подписка / привязка постов к кампании). */
  creatorPlatformUserId: string | null;
  /** Задания с XP из мастера (ключи совпадают с `POST /task`). */
  taskPresets: EdgeTaskPresetPublic[];
  /** Текст ЛС с кодами приглашения для задания «пригласить»; пустой template — сервер подставит дефолт. */
  pingInviteDm: { template: string; codeExpiresInHours: number };
};
