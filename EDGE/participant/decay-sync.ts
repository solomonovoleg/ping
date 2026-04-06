import { findCampaignByPublicId } from "../companion/repo.js";
import { simulateNeedsToNow } from "./character-rules.js";
import { ensureCharacterRow, updateCharacterDecay } from "./character-repo.js";
import type { CharacterRow } from "./db-types.js";
import { parseLifeSimulationConfig, runLifeSimulationTick } from "./life-simulation.js";
import { parseExtra } from "./participant-extra.js";
import { getParticipantEdgeMeta } from "./participant-repo.js";

export async function reconcileCharacterDecay(participantId: string): Promise<CharacterRow | null> {
  let c = await ensureCharacterRow(participantId);
  if (!c) return null;
  const now = new Date();
  const sim = simulateNeedsToNow(parseExtra(c.extra), now);
  let extra = sim.extra;
  const meta = await getParticipantEdgeMeta(participantId);
  if (meta) {
    const campaign = await findCampaignByPublicId(meta.campaignPublicId);
    const lifeCfg = parseLifeSimulationConfig(campaign?.config_json);
    if (lifeCfg.enabled) {
      const life = runLifeSimulationTick(extra, meta.joinedAt, now, lifeCfg);
      extra = life.extra;
    }
  }
  if (
    sim.happy !== c.happy_score ||
    sim.mood !== c.mood ||
    JSON.stringify(extra) !== JSON.stringify(parseExtra(c.extra))
  ) {
    await updateCharacterDecay(participantId, sim.happy, sim.mood, extra, now);
    c = await ensureCharacterRow(participantId);
  }
  return c;
}
