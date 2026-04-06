import { parseMoneyConfigFromRoot } from "../config/parse-money-config.js";

export const MONEY_INVITE_TASK_KEY = "money_invite";

/** Баллы за одно успешное приглашение по правилу `invite_friend` (порог в v1 не дробит — каждое событие = +points). */
export function inviteFriendPointsFromMoneyConfig(configJson: unknown): number {
  const parsed = parseMoneyConfigFromRoot(configJson);
  const rule = parsed.scoringRules.find((r) => r.kind === "invite_friend" && r.enabled !== false);
  if (!rule) return 0;
  return Math.max(0, Math.min(1_000_000, Math.floor(rule.points)));
}
