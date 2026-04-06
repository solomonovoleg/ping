export type GiftTemplatePatch = {
  key?: string;
  title: string;
  description?: string;
  quantity?: number;
  imageUrl?: string;
  videoUrl?: string;
  /** Привязка приза к рейтингам. */
  leaderboardScopes?: Array<"primary" | "secondary">;
  /** Момент подведения итогов по призу (ISO) или null. */
  drawAt?: string | null;
  /** Человекочитаемое правило отбора (для UI и модерации). */
  selectionRule?: string;
  /** ЛС победителю от создателя после розыгрыша этого приза (как followRewardDm). */
  winnerDm?: { enabled?: boolean; text?: string; mediaUrl?: string | null };
};

export type CreatorCampaignPatchBody = {
  title?: string;
  status?: string;
  companionCharacter?: { assetUrl?: string; displayName?: string };
  /** Один абзац → `companion.infoArticle`. */
  companionIntroText?: string;
  giftsTemplates?: GiftTemplatePatch[];
  followRewardEnabled?: boolean;
  leaderboardGlobalEnabled?: boolean;
  leaderboardPrimaryEnabled?: boolean;
  leaderboardSecondaryEnabled?: boolean;
  /**
   * Снять паузу начисления после наступившей даты розыгрыша приза (`drawAt`).
   * Сбрасывается при следующем сохранении списка призов.
   */
  leaderboardPrimaryPrizeDrawRankingFreezeLifted?: boolean;
  leaderboardSecondaryPrizeDrawRankingFreezeLifted?: boolean;
  /** Сбросить ручную заморозку в БД (`primary_leaderboard_frozen_at` → null). */
  leaderboardPrimaryFrozenAtClear?: boolean;
  leaderboardSecondaryFrozenAtClear?: boolean;
  prizeRules?: { pool?: string; method?: string; topN?: number; rankingKind?: "primary" | "secondary" };
  schedule?: {
    drawSummary?: string;
    leaderboardResetSummary?: string;
    endsAt?: string | null;
  };
  followRewardDm?: { enabled?: boolean; text?: string; mediaUrl?: string | null };
  /** Шаблон ЛС с кодами для задания «пригласить» (`{{codes}}`, `{{count}}`). */
  pingInviteDm?: {
    template?: string;
    codeExpiresInHours?: number;
    /** Как выдавать коды в ЛС (см. `ping-invite-pack` на платформе). */
    inviteIssueMode?: "batch_min_count" | "single_per_request" | "one_multi_use";
    /** Для `one_multi_use`: сколько регистраций на один код (2–10000). */
    multiUseRegistrations?: number;
  } | null;
  taskPresets?: { game?: unknown[]; global?: unknown[]; commercial?: unknown[] };
  /** Кто видит пост с EDGE в профиле и ленте: self | followers | public */
  displayAudience?: string;
  /**
   * Рейтинг жизни и очередь запросов персонажа (`config_json.companion.lifeSimulation`).
   * `null` — удалить блок из конфига.
   */
  /** EDGE MONEY: блок `config_json.money` (правила баллов, тиры призов, обложка). */
  moneyConfig?: {
    headline?: string;
    mediaUrl?: string | null;
    scoringRules?: Array<{
      id?: string;
      kind: string;
      threshold: number;
      points: number;
      enabled?: boolean;
      /** Только для `chat_messages`: лимит баллов за сутки UTC; 0 = без лимита. */
      maxPointsPerDay?: number;
    }>;
    prizeTiers?: Array<{
      id?: string;
      fromRank: number;
      toRank: number;
      label: string;
      templateKey?: string;
    }>;
    /** ЛС с кодами для MONEY «пригласить друзей» (`{{codes}}`, `{{count}}`). */
    inviteDm?: {
      template?: string;
      codeExpiresInHours?: number;
    } | null;
    /** Цветовая схема companion-шаблона (default | gold | emerald | rose | violet | cyan). */
    colorScheme?: string;
  };
  companionLifeSimulation?: {
    enabled?: boolean;
    lifeRating?: { min?: number; max?: number; initial?: number };
    intervalsHours?: { feed?: number; toilet?: number; play?: number; calm?: number };
    responseWindowHours?: number;
    onTimeBonus?: number;
    missedPenalty?: number;
    queueFulfillBonus?: number;
    maxMoodBonus?: number;
    maxQueuePerKind?: number;
  } | null;
};
