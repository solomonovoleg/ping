export type EdgeLeaderboardScope = "primary" | "secondary";

export type EdgeGiftTemplate = {
  key: string;
  title: string;
  description?: string;
  quantity?: number;
  imageUrl?: string;
  videoUrl?: string;
  leaderboardScopes?: EdgeLeaderboardScope[];
  drawAt?: string | null;
  selectionRule?: string;
};

export type DrawPrizeResponse = {
  edgeId: string;
  campaignTitle: string;
  drawBatchId: string;
  creatorPlatformUserId: string | null;
  giftKey: string;
  giftLabel: string;
  poolSize: number;
  requestedCount: number;
  drawnCount: number;
  winners: { platformUserId: string; giftKey: string; giftLabel: string }[];
  /**
   * Шаблон ЛС для этого приза (платформа подставляет плейсхолдеры и шлёт от имени создателя).
   * Нет поля или null — использовать текст по умолчанию на платформе.
   */
  winnerDm?: { text: string; mediaUrl: string | null } | null;
};
