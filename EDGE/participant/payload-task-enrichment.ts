import type { PresetVerify } from "../../shared/edge-task-preset-config.js";
import {
  effectiveTaskPresetScoreTarget,
  hasObjectiveTaskVerify,
  listTaskPresetsFromConfig,
  needsEdgeVerify,
  needsPlatformVerify,
} from "../../shared/edge-task-preset-config.js";
import type { TaskGrantRow } from "../tasks/grants-repo.js";
import { listTaskGrantsForParticipant } from "../tasks/grants-repo.js";
import type {
  EdgeTaskGrantPayload,
  EdgeTaskProgressLinePayload,
  EdgeTaskQuestSummaryPayload,
  ParticipantStatePayload,
} from "./types.js";

/** Совпадает с телом клиента `postEdgeParticipantTask` для пресетов. */
export const PRESET_TASK_REF_KEY = "preset_once";

function trackingFor(verify: PresetVerify): "edge" | "platform" | "honor" {
  if (verify.type === "honor") return "honor";
  if (needsPlatformVerify(verify)) return "platform";
  if (needsEdgeVerify(verify)) return "edge";
  return "platform";
}

function findPresetGrant(grants: TaskGrantRow[], taskKey: string): TaskGrantRow | null {
  return grants.find((r) => r.task_key === taskKey && r.ref_key === PRESET_TASK_REF_KEY) ?? null;
}

/** Текущее/цель для условий, которые EDGE проверяет в `apply-preset-task`. */
function readEdgeVerifyProgress(
  v: PresetVerify,
  payload: ParticipantStatePayload,
): { current: number; target: number } | null {
  const gm = payload.gameScriptMetrics;
  switch (v.type) {
    case "edge_min_level":
      return { current: payload.level, target: v.minLevel };
    case "edge_min_xp":
      return { current: payload.xp, target: v.minXp };
    case "edge_min_care_streak":
      return { current: payload.careStreakDays, target: v.minDays };
    case "edge_game_login_streak":
      return { current: gm.gameLoginStreakDays, target: v.minDays };
    case "edge_game_daily_taps":
      return { current: gm.dailyTapCount, target: v.minCount };
    case "edge_game_daily_feeds":
      return { current: gm.dailyFeedCount, target: v.minCount };
    case "edge_game_daily_play":
      return { current: gm.dailyPlayCount, target: v.minCount };
    case "edge_game_daily_toilet":
      return { current: gm.dailyToiletCount, target: v.minCount };
    case "edge_game_daily_calm":
      return { current: gm.dailyCalmCount, target: v.minCount };
    case "edge_game_daily_pet":
      return { current: gm.dailyPetCount, target: v.minCount };
    default:
      return null;
  }
}

export function buildTaskProgressLines(
  configJson: unknown,
  payload: ParticipantStatePayload,
  grants: TaskGrantRow[],
): EdgeTaskProgressLinePayload[] {
  const presets = listTaskPresetsFromConfig(configJson);
  const out: EdgeTaskProgressLinePayload[] = [];

  for (const preset of presets) {
    const scoreTarget = effectiveTaskPresetScoreTarget(preset);
    const verify = preset.verify;
    const tracking = trackingFor(verify);
    const g = findPresetGrant(grants, preset.key);
    const claimed = Boolean(g);
    const xpAwardedIfClaimed = g ? g.xp_awarded : null;

    let current: number | null = null;
    let target: number | null = null;
    let ratio: number | null = null;
    let satisfied = false;

    const objective = hasObjectiveTaskVerify(verify);

    if (claimed) {
      satisfied = true;
      ratio = 1;
    } else if (objective && needsEdgeVerify(verify)) {
      const pair = readEdgeVerifyProgress(verify, payload);
      if (pair) {
        current = pair.current;
        target = pair.target;
        satisfied = current >= target;
        ratio = target > 0 ? Math.min(1, current / target) : null;
      }
    } else {
      satisfied = false;
    }

    const readyToClaim =
      !claimed && objective && (tracking !== "edge" || satisfied);

    out.push({
      taskKey: preset.key,
      scoreTarget,
      tracking,
      claimed,
      xpAwardedIfClaimed,
      current,
      target,
      ratio,
      satisfied,
      readyToClaim,
    });
  }

  return out;
}

/** Агрегаты для UI: только цикл по пресетам + Map по `taskProgress` (без новых SQL). */
export function buildTaskQuestSummary(
  configJson: unknown,
  lines: EdgeTaskProgressLinePayload[],
): EdgeTaskQuestSummaryPayload {
  const presets = listTaskPresetsFromConfig(configJson);
  const byKey = new Map(lines.map((l) => [l.taskKey, l]));

  let objectiveTotal = 0;
  let completedObjective = 0;
  let edgeIncomplete = 0;
  let edgeReadyToClaim = 0;
  let platformOpen = 0;
  let blockedConfig = 0;

  for (const p of presets) {
    if (!hasObjectiveTaskVerify(p.verify)) {
      blockedConfig += 1;
      continue;
    }
    objectiveTotal += 1;
    const l = byKey.get(p.key);
    if (!l) continue;

    if (l.claimed) {
      completedObjective += 1;
      continue;
    }
    if (needsEdgeVerify(p.verify)) {
      if (l.satisfied) edgeReadyToClaim += 1;
      else edgeIncomplete += 1;
    } else if (needsPlatformVerify(p.verify)) {
      platformOpen += 1;
    }
  }

  return {
    presetTotal: presets.length,
    objectiveTotal,
    completedObjective,
    edgeIncomplete,
    edgeReadyToClaim,
    platformOpen,
    blockedConfig,
  };
}

function mapGrantRows(rows: TaskGrantRow[]): EdgeTaskGrantPayload[] {
  return rows.map((r) => ({
    taskKey: r.task_key,
    refKey: r.ref_key,
    xpAwarded: r.xp_awarded,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function enrichParticipantPayloadWithTasks(
  payload: ParticipantStatePayload,
  configJson: unknown,
): Promise<ParticipantStatePayload> {
  const rows = await listTaskGrantsForParticipant(payload.edgeId, payload.platformUserId);
  const grantRows = rows ?? [];
  const lines = buildTaskProgressLines(configJson, payload, grantRows);
  const summary = buildTaskQuestSummary(configJson, lines);
  return {
    ...payload,
    taskGrants: rows ? mapGrantRows(rows) : [],
    taskProgress: lines,
    taskQuestSummary: summary,
  };
}
