import type { Pool } from "pg";
import { getEdgePool } from "../../db/pool.js";
import { computeInteractLocked } from "../../companion/interact-lock.js";
import { parseMoneyConfigFromRoot } from "../config/parse-money-config.js";

export type MoneyPostAccrualTarget = {
  edgeId: string;
  threshold: number;
};

export async function listMoneyPostAccrualTargetsForPlatformUser(
  platformUserId: string,
): Promise<MoneyPostAccrualTarget[] | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const uid = platformUserId.trim();
  if (!uid) return [];
  try {
    const { rows } = await pool.query<{ public_id: string; status: string; config_json: unknown }>(
      `SELECT c.public_id, c.status, c.config_json
       FROM edge_participants p
       INNER JOIN edge_campaigns c ON c.public_id = p.campaign_public_id
       WHERE trim(p.platform_user_id) = trim($1)
         AND p.money_tracking_started_at IS NOT NULL
         AND lower(trim(c.status)) = 'published'
         AND lower(trim(c.edge_type)) = 'money'`,
      [uid],
    );
    const out: MoneyPostAccrualTarget[] = [];
    for (const r of rows) {
      if (computeInteractLocked({ status: r.status, config_json: r.config_json })) continue;
      const parsed = parseMoneyConfigFromRoot(r.config_json);
      const rule = parsed.scoringRules.find((x) => x.kind === "post_created" && x.enabled !== false);
      if (!rule || rule.points <= 0 || rule.threshold < 1) continue;
      out.push({ edgeId: String(r.public_id || "").trim(), threshold: rule.threshold });
    }
    return out;
  } catch (e) {
    console.error("[edge] listMoneyPostAccrualTargetsForPlatformUser", e);
    return null;
  }
}
