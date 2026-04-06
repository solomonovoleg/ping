import { PLAY_RELEASE_ROWS } from "./play-release-rows";

export function buildPlayReleaseTemplate(completed: Set<string>, notesByKey: Record<string, string>): string {
  const header = [
    "PING MOOT — Google Play Release Readiness",
    `Сформировано: ${new Date().toISOString()}`,
    "",
  ];

  const lines = PLAY_RELEASE_ROWS.map((row, index) => {
    const mark = completed.has(row.key) ? "[x]" : "[ ]";
    const note = (notesByKey[row.key] ?? "").trim() || "-";
    return `${index + 1}. ${mark} ${row.title}\n   Роль: ${row.audience}\n   Маршрут: ${row.route}\n   Подтверждение: ${note}`;
  });

  return [...header, ...lines, "", "Итог: публикация разрешена после закрытия всех пунктов."].join("\n");
}
