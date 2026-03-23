import type { Pool } from "pg";
import { getEdgePool } from "../db/pool.js";
import { moodFromHappy } from "./character-rules.js";
import type { CharacterRow } from "./db-types.js";

export type { CharacterRow } from "./db-types.js";

export async function ensureCharacterRow(participantId: string): Promise<CharacterRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    await pool.query(
      `INSERT INTO edge_character_states (participant_id)
       VALUES ($1)
       ON CONFLICT (participant_id) DO NOTHING`,
      [participantId],
    );
    const { rows } = await pool.query<CharacterRow>(
      `SELECT participant_id, level, xp, mood, happy_score, care_streak_days,
              last_fed_at, last_interaction_at, updated_at, extra
       FROM edge_character_states WHERE participant_id = $1`,
      [participantId],
    );
    return rows[0] ?? null;
  } catch (e) {
    console.error("[edge] ensureCharacterRow", e);
    return null;
  }
}

export async function updateCharacterDecay(
  participantId: string,
  happy: number,
  mood: string,
  extra: Record<string, unknown>,
  now: Date,
): Promise<void> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return;
  try {
    await pool.query(
      `UPDATE edge_character_states
       SET happy_score = $2, mood = $3, extra = $4::jsonb, updated_at = $5
       WHERE participant_id = $1`,
      [participantId, happy, mood, JSON.stringify(extra), now],
    );
  } catch (e) {
    console.error("[edge] updateCharacterDecay", e);
  }
}

export async function updateCharacterFeedFull(
  participantId: string,
  opts: {
    now: Date;
    xp: number;
    happy: number;
    mood: string;
    level: number;
    streak: number;
    extra: Record<string, unknown>;
  },
): Promise<CharacterRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    await pool.query(
      `UPDATE edge_character_states
       SET xp = $2,
           happy_score = $3,
           mood = $4,
           level = $5,
           care_streak_days = $6,
           last_fed_at = $7,
           last_interaction_at = $7,
           extra = $8::jsonb,
           updated_at = $7
       WHERE participant_id = $1`,
      [participantId, opts.xp, opts.happy, opts.mood, opts.level, opts.streak, opts.now, JSON.stringify(opts.extra)],
    );
    return ensureCharacterRow(participantId);
  } catch (e) {
    console.error("[edge] updateCharacterFeedFull", e);
    return null;
  }
}

export async function updateCharacterAfterInteract(
  participantId: string,
  opts: {
    now: Date;
    xp: number;
    happy: number;
    mood: string;
    level: number;
    extra: Record<string, unknown>;
  },
): Promise<CharacterRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    await pool.query(
      `UPDATE edge_character_states
       SET xp = $2,
           happy_score = $3,
           mood = $4,
           level = $5,
           last_interaction_at = $6,
           extra = $7::jsonb,
           updated_at = $6
       WHERE participant_id = $1`,
      [participantId, opts.xp, opts.happy, opts.mood, opts.level, opts.now, JSON.stringify(opts.extra)],
    );
    return ensureCharacterRow(participantId);
  } catch (e) {
    console.error("[edge] updateCharacterAfterInteract", e);
    return null;
  }
}

/** XP за задание (в т.ч. штраф пресета): happy слегка растёт при плюсе и падает при минусе, XP ≥ 0. */
export async function updateCharacterExtraOnly(
  participantId: string,
  extra: Record<string, unknown>,
  now: Date,
): Promise<CharacterRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  try {
    await pool.query(
      `UPDATE edge_character_states
       SET extra = $2::jsonb,
           updated_at = $3
       WHERE participant_id = $1`,
      [participantId, JSON.stringify(extra), now],
    );
    return ensureCharacterRow(participantId);
  } catch (e) {
    console.error("[edge] updateCharacterExtraOnly", e);
    return null;
  }
}

export async function incrementCharacterTaskXp(
  participantId: string,
  xpDelta: number,
  now: Date,
): Promise<CharacterRow | null> {
  const pool: Pool | null = getEdgePool();
  if (!pool) return null;
  const c = await ensureCharacterRow(participantId);
  if (!c) return null;
  const clamped = Math.max(-500, Math.min(500, Math.floor(xpDelta)));
  const newXp = Math.max(0, c.xp + clamped);
  const newLevel = Math.floor(newXp / 100);
  const happyBump =
    clamped > 0 ? Math.min(3, clamped) : clamped < 0 ? Math.max(-6, clamped) : 0;
  const newHappy = Math.min(100, Math.max(0, c.happy_score + happyBump));
  const newMood = moodFromHappy(newHappy);
  try {
    await pool.query(
      `UPDATE edge_character_states
       SET xp = $2,
           level = $3,
           happy_score = $4,
           mood = $5,
           last_interaction_at = $6,
           updated_at = $6
       WHERE participant_id = $1`,
      [participantId, newXp, newLevel, newHappy, newMood, now],
    );
    return ensureCharacterRow(participantId);
  } catch (e) {
    console.error("[edge] incrementCharacterTaskXp", e);
    return null;
  }
}
