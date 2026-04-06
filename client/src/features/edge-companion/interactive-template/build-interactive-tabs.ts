import type { CompanionSurfaceId } from "@/features/edge-companion/companion-surfaces/types";

/** Вкладка «Друзья» — только клиент, если в кампании настроены приглашения. */
export type EdgeTemplateTabId = CompanionSurfaceId | "friends";

const TEMPLATE_SEQUENCE: (CompanionSurfaceId | "friends")[] = [
  "prizes",
  "leaderboard",
  "leaderboardSecondary",
  "results",
  "character",
  "info",
  "tasks",
  "friends",
];

/**
 * Порядок как в макете interactive-post; показываем только разрешённые в `visible` экраны,
 * плюс «Друзья» в конце при `showFriends`.
 */
export function buildInteractiveTabs(
  visible: CompanionSurfaceId[],
  showFriends: boolean,
): EdgeTemplateTabId[] {
  const allowed = new Set<CompanionSurfaceId>(visible);
  const out: EdgeTemplateTabId[] = [];
  for (const id of TEMPLATE_SEQUENCE) {
    if (id === "friends") {
      if (showFriends) out.push("friends");
      continue;
    }
    if (allowed.has(id)) out.push(id);
  }
  return out;
}

export function tabLabel(id: EdgeTemplateTabId): string {
  if (id === "friends") return "Друзья";
  const map: Record<CompanionSurfaceId, string> = {
    tasks: "Задания",
    character: "Игра",
    info: "Правила",
    leaderboard: "Рейтинг",
    leaderboardSecondary: "Активность",
    results: "Выиграть деньги",
    prizes: "Призы",
  };
  return map[id];
}
