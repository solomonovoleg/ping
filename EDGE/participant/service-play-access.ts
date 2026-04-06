import { getCampaignPlayLocked } from "./service-helpers.js";
import { getEdgePool } from "../db/pool.js";

export type PlayAccessState = "ok" | "locked" | null;

export function resolvePlayAccessState(
  hasPool: boolean,
  locked: boolean | null,
): PlayAccessState {
  if (!hasPool) return null;
  if (locked === null) return null;
  if (locked) return "locked";
  return "ok";
}

export async function ensurePlayAccess(edgeId: string): Promise<PlayAccessState> {
  if (!getEdgePool()) return null;
  const locked = await getCampaignPlayLocked(edgeId);
  return resolvePlayAccessState(true, locked);
}
