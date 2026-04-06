/** Ответ для клиента (через платформу `/api/edge/participant/*`). */
/** Счётчики скриптов заданий за текущий UTC-день + серия заходов в компаньон. */
export type GameScriptMetricsPayload = {
  gameDailyYmd: string;
  gameLoginStreakDays: number;
  dailyTapCount: number;
  dailyFeedCount: number;
  dailyPlayCount: number;
  dailyToiletCount: number;
  dailyCalmCount: number;
  dailyPetCount: number;
};

export type PetNeedsPayload = {
  hunger: number;
  hygiene: number;
  energy: number;
  comfort: number;
};

export type ActionProgressPayload = {
  feed: number;
  toilet: number;
  play: number;
  target: number;
};

/** Элемент очереди запросов персонажа (рейтинг жизни). */
export type LifeSimQueueItemPayload = {
  id: string;
  kind: "feed" | "toilet" | "play" | "calm";
  spawnedAt: string;
  /** До этого момента — «вовремя» для бонуса onTime. */
  respondUntilAt: string;
  penalized: boolean;
  overdue: boolean;
};

export type LifeSimulationStatePayload =
  | {
      enabled: true;
      lifeRating: number;
      lifeMin: number;
      lifeMax: number;
      needQueue: LifeSimQueueItemPayload[];
    }
  | { enabled: false };

/** Строка в `edge_task_grants` (награда за задание / встроенный ключ). */
export type EdgeTaskGrantPayload = {
  taskKey: string;
  refKey: string;
  xpAwarded: number;
  createdAt: string;
};

/**
 * Прогресс по пресету для UI (как в «тамагочи»): где считаем на EDGE, где только при «Забрать».
 * `readyToClaim`: можно жать «Забрать награду» (без учёта паузы кампании — её даёт клиент).
 */
export type EdgeTaskProgressLinePayload = {
  taskKey: string;
  scoreTarget: "primary" | "secondary";
  tracking: "edge" | "platform" | "honor";
  claimed: boolean;
  xpAwardedIfClaimed: number | null;
  current: number | null;
  target: number | null;
  /** 0..1 для полосы; null — нет числового прогресса (платформа / честь). */
  ratio: number | null;
  /** Условие EDGE выполнено (для tracking=edge). */
  satisfied: boolean;
  readyToClaim: boolean;
};

/**
 * Сводка по заданиям кампании для UI (один проход по пресетам + уже посчитанным `taskProgress`).
 * Не добавляет запросов к БД. Все счётчики — только про этого участника и эту кампанию.
 */
export type EdgeTaskQuestSummaryPayload = {
  presetTotal: number;
  /** Пресеты с объективной серверной проверкой (не honor). */
  objectiveTotal: number;
  /** Из objectiveTotal — награда уже получена (строка в `edge_task_grants`). */
  completedObjective: number;
  /** Условие EDGE ещё не выполнено (виден числовой прогресс в игре). */
  edgeIncomplete: number;
  /** Условие EDGE выполнено, осталось нажать «Забрать». */
  edgeReadyToClaim: number;
  /** Условие платформы, награда не получена (пост, приглашения…). */
  platformOpen: number;
  /** honor / битый verify — награда недоступна до правки конфига. */
  blockedConfig: number;
};

export const EMPTY_TASK_QUEST_SUMMARY: EdgeTaskQuestSummaryPayload = {
  presetTotal: 0,
  objectiveTotal: 0,
  completedObjective: 0,
  edgeIncomplete: 0,
  edgeReadyToClaim: 0,
  platformOpen: 0,
  blockedConfig: 0,
};

export type ParticipantStatePayload = {
  edgeId: string;
  platformUserId: string;
  level: number;
  xp: number;
  primaryXp: number;
  secondaryXp: number;
  mood: string;
  happyScore: number;
  careStreakDays: number;
  lastFedAt: string | null;
  lastInteractionAt: string | null;
  joinedAt: string;
  /** Рекомендуемое время следующего корма (ISO). null — уже просрочено или нет данных. */
  careDeadlineAt: string | null;
  gameScriptMetrics: GameScriptMetricsPayload;
  petNeeds: PetNeedsPayload;
  /** Что сейчас требует внимания (автономная жизнь питомца, не зависит от заданий). */
  activeNeed: "hungry" | "dirty" | "bored" | "anxious" | null;
  /** Кнопка, которую лучше нажать сейчас (учитывает активную нужду и незавершённый прогресс 15/15). */
  recommendedAction: "feed" | "toilet" | "play" | "calm" | "pet" | "tap" | null;
  actionProgress: ActionProgressPayload;
  /** Сквозной счётчик тапов по персонажу (онбординг в клиенте). */
  introTapCount: number;
  /** Рейтинг жизни и очередь запросов (`companion.lifeSimulation` в конфиге кампании). */
  lifeSimulation: LifeSimulationStatePayload;
  /** История начислений за задания (и встроенные ключи с ref). */
  taskGrants: EdgeTaskGrantPayload[];
  /** По каждому пресету из конфига — прогресс и флаги для кнопки «Забрать». */
  taskProgress: EdgeTaskProgressLinePayload[];
  /** Агрегаты для индикации «квестов» без доп. нагрузки на сервер. */
  taskQuestSummary: EdgeTaskQuestSummaryPayload;
};

/**
 * Топ участников кампании по XP.
 * `platformUserId` — только для server-to-server; платформа подмешивает имя/аватар и не отдаёт id в браузер.
 */
export type LeaderboardEntryPayload = {
  rank: number;
  xp: number;
  level: number;
  careStreakDays: number;
  isMe: boolean;
  platformUserId: string;
};

export type LeaderboardPayload = {
  edgeId: string;
  kind: "primary" | "secondary";
  frozen: boolean;
  entries: LeaderboardEntryPayload[];
  totalParticipants: number;
  /** Ранг текущего пользователя (1-based) или null, если не в топе / не участвовал. */
  myRank: number | null;
};
