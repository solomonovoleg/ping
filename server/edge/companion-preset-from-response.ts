import { needsPlatformVerify, parsePresetVerify, type PresetVerify } from "@shared/edge-task-preset-config";

/** Разбор пресета из тела `GET /v1/companion/campaign-config` (плоский массив `taskPresets`). */
export function extractPresetVerifyFromCompanionBody(
  bodyText: string,
  taskKey: string,
): { verify: PresetVerify; creatorPlatformUserId: string | null } | null {
  let j: unknown;
  try {
    j = JSON.parse(bodyText);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const root = j as Record<string, unknown>;
  const list = root.taskPresets;
  if (!Array.isArray(list)) return null;
  const k = taskKey.trim();
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    if (typeof o.key !== "string" || o.key.trim() !== k) continue;
    const verify = parsePresetVerify(o.verify);
    const c = root.creatorPlatformUserId;
    const creatorPlatformUserId = typeof c === "string" && c.trim() ? c.trim() : null;
    return { verify, creatorPlatformUserId };
  }
  return null;
}

export { needsPlatformVerify };
