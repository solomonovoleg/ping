export type CampaignEdgeType = "character" | "money";

export function normalizeCampaignEdgeType(raw: string): CampaignEdgeType {
  return raw.trim() === "money" ? "money" : "character";
}
