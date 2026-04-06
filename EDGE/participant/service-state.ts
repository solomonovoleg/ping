import type { ParticipantStatePayload } from "./types.js";
import { ensureParticipant, updateCharacterExtraOnly } from "./repo.js";
import { reconcileCharacterDecay } from "./decay-sync.js";
import { touchCompanionOpen } from "./game-script-metrics.js";
import { parseExtra } from "./participant-extra.js";
import { mapPayloadEnriched } from "./service-helpers.js";
import { findCampaignByPublicId } from "../companion/repo.js";
import { getEdgePool } from "../db/pool.js";

export async function getParticipantStateCore(
  edgeId: string,
  platformUserId: string,
): Promise<ParticipantStatePayload | null> {
  if (!getEdgePool()) return null;
  const p = await ensureParticipant(edgeId, platformUserId);
  if (!p) return null;
  let c = await reconcileCharacterDecay(p.id);
  if (!c) return null;
  const now = new Date();
  const extra0 = parseExtra(c.extra);
  const extra1 = touchCompanionOpen(extra0, now);
  if (JSON.stringify(extra0) !== JSON.stringify(extra1)) {
    const c2 = await updateCharacterExtraOnly(p.id, extra1, now);
    if (c2) c = c2;
  }
  const campaign = await findCampaignByPublicId(edgeId);
  return mapPayloadEnriched(edgeId, platformUserId, p, c, now, campaign?.config_json ?? null);
}
