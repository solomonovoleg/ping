import { getEdgePool } from "../db/pool.js";
import { findCampaignByPublicId } from "../companion/repo.js";

/** Полная замена `config_json.companion` (объект из админки). */
export async function replaceCampaignCompanionJson(
  publicId: string,
  companion: Record<string, unknown>,
): Promise<boolean> {
  const pool = getEdgePool();
  if (!pool) return false;
  const id = publicId.trim();
  if (!id) return false;
  const row = await findCampaignByPublicId(id);
  if (!row) return false;
  let root: Record<string, unknown> = {};
  if (row.config_json && typeof row.config_json === "object" && !Array.isArray(row.config_json)) {
    root = { ...(row.config_json as Record<string, unknown>) };
  }
  root.companion = companion;
  try {
    await pool.query(
      `UPDATE edge_campaigns SET config_json = $1::jsonb, updated_at = now() WHERE public_id = $2`,
      [JSON.stringify(root), id],
    );
    return true;
  } catch (e) {
    console.error("[edge] replaceCampaignCompanionJson", e);
    return false;
  }
}
