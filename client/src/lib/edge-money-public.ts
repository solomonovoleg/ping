import { API, apiFetch } from "@/lib/api-base";

export type EdgeMoneyScoringRulePublic = {
  id: string;
  kind: string;
  threshold: number;
  points: number;
  enabled: boolean;
  /** Лимит баллов за сутки UTC (чат, звонок, follow, посты, реакции); отсутствие или 0 — без лимита. */
  maxPointsPerDay?: number;
};

export type EdgeMoneyPrizeTierPublic = {
  id: string;
  fromRank: number;
  toRank: number;
  label: string;
  templateKey?: string;
};

export type EdgeMoneyColorScheme = "default" | "gold" | "emerald" | "rose" | "violet" | "cyan";

export type EdgeMoneyBlockPublic = {
  version: 1;
  headline: string;
  mediaUrl: string | null;
  scoringRules: EdgeMoneyScoringRulePublic[];
  prizeTiers: EdgeMoneyPrizeTierPublic[];
  inviteDm?: { template: string; codeExpiresInHours: number };
  colorScheme?: EdgeMoneyColorScheme;
};

/** Публичный ответ `GET /api/edge/money/campaign-config` (как у EDGE). */
export type EdgeMoneyCampaignConfig = {
  edgeId: string;
  edgeType: "money";
  status: "draft" | "published" | "paused" | "ended";
  title: string;
  scheduleEndsAt: string | null;
  displayAudience: "self" | "followers" | "public";
  creatorPlatformUserId: string | null;
  interactLocked: boolean;
  money: EdgeMoneyBlockPublic;
  leaderboardPrimaryEnabled: boolean;
  leaderboardSecondaryEnabled: boolean;
  leaderboardPrimaryFrozenEffective: boolean;
  leaderboardSecondaryFrozenEffective: boolean;
};

export async function fetchEdgeMoneyCampaignConfig(edgeId: string): Promise<EdgeMoneyCampaignConfig> {
  const id = edgeId.trim();
  if (!id) throw new Error("Не указан edgeId.");
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/money/campaign-config?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeMoneyCampaignConfig;
}
