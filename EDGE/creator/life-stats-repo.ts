import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";

export type CampaignLifeStatsPayload = {
  edgeId: string;
  totalParticipants: number;
  withCharacterState: number;
  withLifeRating: number;
  avgLifeRating: number | null;
  minLifeRating: number | null;
  maxLifeRating: number | null;
  totalQueuedNeeds: number;
  participantsWithPendingQueue: number;
};

/**
 * Агрегаты по `extra` персонажей (рейтинг жизни, очередь запросов).
 * Участник без строки в `edge_character_states` даёт NULL по полям персонажа.
 */
export async function fetchCampaignLifeStats(campaignPublicId: string): Promise<CampaignLifeStatsPayload | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const id = campaignPublicId.trim();
  if (!id) return null;
  try {
    const { rows } = await pool.query<{
      total_participants: string;
      with_character_state: string;
      with_life_rating: string;
      avg_life_rating: string | null;
      min_life_rating: string | null;
      max_life_rating: string | null;
      total_queued: string;
      with_queue: string;
    }>(
      `SELECT
         COUNT(ep.id)::text AS total_participants,
         COUNT(ecs.participant_id)::text AS with_character_state,
         COUNT(ecs.participant_id) FILTER (
           WHERE ecs.extra ? 'lifeRating'
             AND (ecs.extra->>'lifeRating') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         )::text AS with_life_rating,
         AVG((ecs.extra->>'lifeRating')::double precision) FILTER (
           WHERE ecs.extra ? 'lifeRating'
             AND (ecs.extra->>'lifeRating') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         )::text AS avg_life_rating,
         MIN((ecs.extra->>'lifeRating')::double precision) FILTER (
           WHERE ecs.extra ? 'lifeRating'
             AND (ecs.extra->>'lifeRating') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         )::text AS min_life_rating,
         MAX((ecs.extra->>'lifeRating')::double precision) FILTER (
           WHERE ecs.extra ? 'lifeRating'
             AND (ecs.extra->>'lifeRating') ~ '^-?[0-9]+(\\.[0-9]+)?$'
         )::text AS max_life_rating,
         COALESCE(
           SUM(
             CASE
               WHEN jsonb_typeof(ecs.extra->'lifeNeedQueue') = 'array'
               THEN jsonb_array_length(ecs.extra->'lifeNeedQueue')
               ELSE 0
             END
           ),
           0
         )::text AS total_queued,
         COUNT(*) FILTER (
           WHERE jsonb_typeof(ecs.extra->'lifeNeedQueue') = 'array'
             AND jsonb_array_length(ecs.extra->'lifeNeedQueue') > 0
         )::text AS with_queue
       FROM edge_participants ep
       LEFT JOIN edge_character_states ecs ON ecs.participant_id = ep.id
       WHERE ep.campaign_public_id = $1`,
      [id],
    );
    const r = rows[0];
    if (!r) {
      return {
        edgeId: id,
        totalParticipants: 0,
        withCharacterState: 0,
        withLifeRating: 0,
        avgLifeRating: null,
        minLifeRating: null,
        maxLifeRating: null,
        totalQueuedNeeds: 0,
        participantsWithPendingQueue: 0,
      };
    }
    const num = (s: string | null): number | null => {
      if (s === null || s === "") return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };
    const int = (s: string) => {
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    };
    return {
      edgeId: id,
      totalParticipants: int(r.total_participants),
      withCharacterState: int(r.with_character_state),
      withLifeRating: int(r.with_life_rating),
      avgLifeRating: num(r.avg_life_rating),
      minLifeRating: num(r.min_life_rating),
      maxLifeRating: num(r.max_life_rating),
      totalQueuedNeeds: int(r.total_queued),
      participantsWithPendingQueue: int(r.with_queue),
    };
  } catch (e) {
    console.error("[edge] fetchCampaignLifeStats", e);
    return null;
  }
}
