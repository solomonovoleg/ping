import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export async function countWinnersForGift(campaignPublicId: string, giftKey: string): Promise<number | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM edge_prize_winners
       WHERE campaign_public_id = $1 AND gift_key = $2`,
      [campaignPublicId, giftKey],
    );
    return Number.parseInt(rows[0]?.c ?? "0", 10) || 0;
  } catch (e) {
    console.error("[edge] countWinnersForGift", e);
    return null;
  }
}

/**
 * Упорядоченный пул участников для розыгрыша (до фильтра «уже выиграли»).
 * `top`: топ по выбранному рейтингу (primary / secondary XP); `all` + method `first` — по дате входа.
 */
export async function listOrderedParticipantPool(
  campaignPublicId: string,
  pool: "all" | "top",
  topN: number,
  rankingKind: "primary" | "secondary" = "primary",
): Promise<string[] | null> {
  const poolPg: Pool | null = getEdgePool();
  if (!poolPg) return null;
  const cap = Math.min(5000, Math.max(1, Math.floor(topN) || 50));
  try {
    if (pool === "all") {
      const { rows } = await poolPg.query<{ platform_user_id: string }>(
        `SELECT platform_user_id FROM edge_participants
         WHERE campaign_public_id = $1
         ORDER BY joined_at ASC`,
        [campaignPublicId],
      );
      return rows.map((r) => r.platform_user_id);
    }
    const scoreExpr =
      rankingKind === "secondary"
        ? "COALESCE(c.secondary_xp, 0)"
        : "COALESCE(c.primary_xp, c.xp, 0)";
    const { rows } = await poolPg.query<{ platform_user_id: string }>(
      `SELECT p.platform_user_id
       FROM edge_participants p
       LEFT JOIN edge_character_states c ON c.participant_id = p.id
       WHERE p.campaign_public_id = $1
       ORDER BY ${scoreExpr} DESC, COALESCE(c.level, 0) DESC, p.joined_at ASC
       LIMIT $2`,
      [campaignPublicId, cap],
    );
    return rows.map((r) => r.platform_user_id);
  } catch (e) {
    console.error("[edge] listOrderedParticipantPool", e);
    return null;
  }
}
