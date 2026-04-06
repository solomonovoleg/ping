import type { EdgeMoneyScoringRulePublic } from "@/lib/edge-money-public";
import type { EdgeMoneyTaskProgressItemDto } from "@/lib/edge-money-task-progress-api";

export function progressItemForScoringRule(
  r: EdgeMoneyScoringRulePublic,
  items: EdgeMoneyTaskProgressItemDto[] | undefined,
): EdgeMoneyTaskProgressItemDto | undefined {
  if (!items?.length) return undefined;
  const id = r.id.trim();
  return items.find((t) => t.ruleId === id || (!id && t.ruleId === r.kind));
}

/** Сколько включённых правил выполнено (ratio ≥ 1 или follow), из тех что пришли в task-progress. */
export function countCompletedMoneyTasks(
  rules: EdgeMoneyScoringRulePublic[],
  items: EdgeMoneyTaskProgressItemDto[] | undefined,
): { completed: number; total: number } {
  const active = rules.filter((r) => r.enabled);
  const progressItems = active
    .map((r) => progressItemForScoringRule(r, items))
    .filter((p): p is EdgeMoneyTaskProgressItemDto => Boolean(p));
  const completed = progressItems.filter((p) => (p.followCompleted ? true : (p.ratio ?? 0) >= 1)).length;
  return { completed, total: active.length };
}
