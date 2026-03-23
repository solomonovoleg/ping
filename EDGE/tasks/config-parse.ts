import type { TaskKey } from "./types.js";

const DEFAULT_XP: Record<TaskKey, number> = {
  view_post: 3,
  react_post: 5,
  share_post: 8,
  follow_creator: 12,
};

function readTasksBlock(configJson: unknown): Record<string, unknown> | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) return null;
  const root = configJson as Record<string, unknown>;
  const tasks = root.tasks ?? root.edgeTasks;
  if (tasks && typeof tasks === "object" && !Array.isArray(tasks)) {
    return tasks as Record<string, unknown>;
  }
  return null;
}

function xpFromEntry(entry: unknown): number | null {
  if (typeof entry === "number" && Number.isFinite(entry)) return Math.max(0, Math.min(500, Math.floor(entry)));
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const xp = (entry as { xp?: unknown }).xp;
    if (typeof xp === "number" && Number.isFinite(xp)) return Math.max(0, Math.min(500, Math.floor(xp)));
  }
  return null;
}

export function taskXpForKey(configJson: unknown, taskKey: TaskKey): number {
  const block = readTasksBlock(configJson);
  if (!block) return DEFAULT_XP[taskKey];
  const raw = block[taskKey];
  const n = xpFromEntry(raw);
  return n ?? DEFAULT_XP[taskKey];
}
