import { listEnabledBindingsForWorker, touchBindingRun } from "../storage/repo.js";
import { runBindingIngest } from "./ingest.js";

const TICK_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let started = false;
let inFlight = false;

function bindingIsDue(binding: { lastRunAt: Date | null; parseIntervalMinutes: number }): boolean {
  if (!binding.lastRunAt) return true;
  const elapsed = Date.now() - binding.lastRunAt.getTime();
  return elapsed >= binding.parseIntervalMinutes * 60_000;
}

async function tick(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const bindings = await listEnabledBindingsForWorker();
    const now = new Date();
    for (const b of bindings) {
      if (!bindingIsDue(b)) continue;
      try {
        const result = await runBindingIngest(b);
        await touchBindingRun(b.id, {
          lastRunAt: now,
          lastError: null,
          lastCreatedCount: result.created,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[parser] binding", b.id, msg);
        await touchBindingRun(b.id, {
          lastRunAt: now,
          lastError: msg.slice(0, 2000),
          lastCreatedCount: 0,
        });
      }
    }
  } finally {
    inFlight = false;
  }
}

export function startParserWorker(): void {
  if (started) return;
  started = true;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
}

export async function runParserTickNow(): Promise<void> {
  await tick();
}
