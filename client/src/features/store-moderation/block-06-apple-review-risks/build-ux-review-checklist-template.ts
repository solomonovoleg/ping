import { UX_REVIEW_ROWS } from "./ux-review-rows";

type NotesByKey = Record<string, string>;

export function buildUxReviewChecklistTemplate(completedKeys: Set<string>, notesByKey: NotesByKey): string {
  const generatedAt = new Date().toISOString();
  const header = [
    "PING MOOT — Apple Review UX Check (пункт 11)",
    `Сформировано: ${generatedAt}`,
    "",
    "Критерии:",
    "- Понятно куда нажимать",
    "- Нет тупиков",
    "- Нет состояния «ничего не происходит»",
    "- Основные функции доступны за 1–2 клика",
    "",
  ];

  const lines = UX_REVIEW_ROWS.map((row, index) => {
    const marker = completedKeys.has(row.key) ? "[x]" : "[ ]";
    const note = (notesByKey[row.key] ?? "").trim();
    return `${index + 1}. ${marker} ${row.title}\n   Маршрут проверки: ${row.route}\n   Почему важно: ${row.whyItMatters}\n   Подтверждение: ${note || "-"}`;
  });

  return [...header, ...lines, "", "Итог: готово к ревью после прохождения всех пунктов."].join("\n");
}
