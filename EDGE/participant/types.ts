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

export type ParticipantStatePayload = {
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
  /** Рекомендуемое время следующего корма (ISO). null — уже просрочено или нет данных. */
  careDeadlineAt: string | null;
  gameScriptMetrics: GameScriptMetricsPayload;
  petNeeds: PetNeedsPayload;
  /** Что сейчас требует внимания (автономная жизнь питомца, не зависит от заданий). */
  activeNeed: "hungry" | "dirty" | "bored" | "anxious" | null;
  /** Кнопка, которую лучше нажать сейчас (учитывает активную нужду и незавершённый прогресс 15/15). */
  recommendedAction: "feed" | "toilet" | "play" | "calm" | "pet" | "tap" | null;
  actionProgress: ActionProgressPayload;
};

/** Топ участников кампании по XP (без чужих user id в ответе). */
export type LeaderboardEntryPayload = {
  rank: number;
  xp: number;
  level: number;
  careStreakDays: number;
  isMe: boolean;
};

export type LeaderboardPayload = {
  edgeId: string;
  entries: LeaderboardEntryPayload[];
  totalParticipants: number;
  /** Ранг текущего пользователя (1-based) или null, если не в топе / не участвовал. */
  myRank: number | null;
};
