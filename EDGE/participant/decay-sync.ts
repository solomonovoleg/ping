import { simulateNeedsToNow } from "./character-rules.js";
import { ensureCharacterRow, updateCharacterDecay } from "./character-repo.js";
import type { CharacterRow } from "./db-types.js";
import { parseExtra } from "./payload.js";

export async function reconcileCharacterDecay(participantId: string): Promise<CharacterRow | null> {
  let c = await ensureCharacterRow(participantId);
  if (!c) return null;
  const now = new Date();
  const sim = simulateNeedsToNow(parseExtra(c.extra), now);
  if (
    sim.happy !== c.happy_score ||
    sim.mood !== c.mood ||
    JSON.stringify(sim.extra) !== JSON.stringify(parseExtra(c.extra))
  ) {
    await updateCharacterDecay(participantId, sim.happy, sim.mood, sim.extra, now);
    c = await ensureCharacterRow(participantId);
  }
  return c;
}
