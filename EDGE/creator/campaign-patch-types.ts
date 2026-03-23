export type GiftTemplatePatch = {
  key?: string;
  title: string;
  description?: string;
  quantity?: number;
  imageUrl?: string;
  videoUrl?: string;
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
  prizeRules?: { pool?: string; method?: string; topN?: number };
  schedule?: {
    drawSummary?: string;
    leaderboardResetSummary?: string;
    endsAt?: string | null;
  };
  followRewardDm?: { enabled?: boolean; text?: string; mediaUrl?: string | null };
  /** Шаблон ЛС с кодами для задания «пригласить» (`{{codes}}`, `{{count}}`). */
  pingInviteDm?: { template?: string; codeExpiresInHours?: number } | null;
  taskPresets?: { game?: unknown[]; global?: unknown[]; commercial?: unknown[] };
};
