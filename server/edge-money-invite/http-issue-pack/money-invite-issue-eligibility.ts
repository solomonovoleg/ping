import type { ParsedMoneyUpstream } from "./parse-money-upstream-json";

export type MoneyInviteIssueEligibility =
  | { ok: true; creatorId: string; template: string; codeExpiresInHours: number }
  | { ok: false; status: number; error: string };

const DEFAULT_HOURS = 168;

export function evaluateMoneyInviteIssueEligibility(
  parsed: ParsedMoneyUpstream | null,
  defaultTemplate: string,
): MoneyInviteIssueEligibility {
  if (!parsed) {
    return { ok: false, status: 503, error: "edge_money_invalid_json" };
  }
  if ((parsed.edgeType || "").trim() !== "money") {
    return { ok: false, status: 409, error: "edge_type_not_money" };
  }
  if (parsed.interactLocked === true) {
    return { ok: false, status: 403, error: "edge_money_interact_locked" };
  }
  const creatorId = typeof parsed.creatorPlatformUserId === "string" ? parsed.creatorPlatformUserId.trim() : "";
  if (!creatorId) {
    return { ok: false, status: 400, error: "campaign_creator_unknown" };
  }
  const rules = Array.isArray(parsed.money?.scoringRules) ? parsed.money!.scoringRules! : [];
  const hasInvite = rules.some(
    (r) => (r.kind || "").trim() === "invite_friend" && r.enabled !== false,
  );
  if (!hasInvite) {
    return { ok: false, status: 400, error: "invite_friend_rule_disabled" };
  }
  const dm = parsed.money?.inviteDm;
  const custom = typeof dm?.template === "string" ? dm.template.trim() : "";
  const template = custom || defaultTemplate;
  const h = Number(dm?.codeExpiresInHours);
  const codeExpiresInHours = Number.isFinite(h) ? Math.min(720, Math.max(1, Math.floor(h))) : DEFAULT_HOURS;
  return { ok: true, creatorId, template, codeExpiresInHours };
}
