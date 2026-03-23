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
};
