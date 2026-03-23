import type { Request, Response, NextFunction } from "express";
import { applyTaskReward, parseTaskKey, sanitizeTaskRef } from "./apply-task.js";
import { applyPresetTaskReward } from "./apply-preset-task.js";
import { TASK_KEYS, type TaskKey } from "./types.js";

function parsePresetTaskKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim();
  if (!k || k.length > 64) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(k)) return null;
  if ((TASK_KEYS as readonly string[]).includes(k)) return null;
  return k;
}

export async function postTaskReward(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const edgeId = String(req.query.edgeId ?? "").trim();
    const userId = req.edgePlatformUserId ?? "";
    if (!edgeId) {
      res.status(400).json({ error: "edgeId_required" });
      return;
    }
    const body = (req.body ?? {}) as { taskKey?: unknown; ref?: unknown };
    const ref = typeof body.ref === "string" ? sanitizeTaskRef(body.ref) : "";
    if (!ref || ref === "_") {
      res.status(400).json({ error: "ref_required" });
      return;
    }

    const builtin = parseTaskKey(body.taskKey) as TaskKey | null;
    if (builtin) {
      const out = await applyTaskReward(edgeId, userId, builtin, ref);
      if (!out) {
        res.status(503).json({ error: "edge_db_unavailable" });
        return;
      }
      res.json(out);
      return;
    }

    const presetKey = parsePresetTaskKey(body.taskKey);
    if (!presetKey) {
      res.status(400).json({ error: "invalid_task_key" });
      return;
    }

    const out = await applyPresetTaskReward(edgeId, userId, presetKey, ref);
    if (!out) {
      res.status(503).json({ error: "edge_db_unavailable" });
      return;
    }
    res.json(out);
  } catch (e) {
    next(e);
  }
}
