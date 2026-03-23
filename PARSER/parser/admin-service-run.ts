import {
  getBindingById,
  listEnabledBindingsForWorker,
  touchBindingRun,
} from "../storage/repo.js";
import { runBindingIngest } from "./ingest.js";
import { vkUsersGet } from "./vk-wall.js";

export async function adminRunBindingNow(bindingId: string): Promise<{
  created: number;
  skipped: number;
  duplicates: number;
}> {
  const binding = await getBindingById(bindingId);
  if (!binding) throw new Error("Привязка не найдена");
  if (!binding.enabled) throw new Error("Привязка выключена");
  const result = await runBindingIngest(binding);
  await touchBindingRun(binding.id, {
    lastRunAt: new Date(),
    lastError: null,
    lastCreatedCount: result.created,
  });
  return result;
}

export async function adminRunAllEnabledNow(): Promise<
  Array<
    | { bindingId: string; ok: true; created: number; skipped: number; duplicates: number }
    | { bindingId: string; ok: false; error: string }
  >
> {
  const bindings = await listEnabledBindingsForWorker();
  const out: Array<
    | { bindingId: string; ok: true; created: number; skipped: number; duplicates: number }
    | { bindingId: string; ok: false; error: string }
  > = [];
  for (const b of bindings) {
    try {
      const result = await runBindingIngest(b);
      await touchBindingRun(b.id, {
        lastRunAt: new Date(),
        lastError: null,
        lastCreatedCount: result.created,
      });
      out.push({ bindingId: b.id, ok: true, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await touchBindingRun(b.id, {
        lastRunAt: new Date(),
        lastError: msg.slice(0, 2000),
        lastCreatedCount: 0,
      });
      out.push({ bindingId: b.id, ok: false, error: msg });
    }
  }
  return out;
}

export async function adminTestVkToken(token: string): Promise<{ vkUserId: number }> {
  const t = token?.trim();
  if (!t) throw new Error("Пустой токен");
  const u = await vkUsersGet(t);
  return { vkUserId: u.id };
}
