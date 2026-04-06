/** Экранирование для RegExp из произвольной строки (имя в @упоминании). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Если пользователь уже начал ответ с @[Имя](id) или @ник, не дублируем префикс «Имя, » в UI.
 */
export function stripLeadingReplyMention(text: string, parentDisplayName: string): string {
  const name = parentDisplayName.trim();
  if (!name) return text;

  const t = text.replace(/^\s+/, "");
  const bracket = /^@\[([^\]]+)\]\((\d+)\)\s*/u.exec(t);
  if (bracket) {
    const label = (bracket[1] ?? "").trim().toLowerCase();
    const full = name.toLowerCase();
    const firstWord = (name.split(/\s+/)[0] ?? "").toLowerCase();
    if (label === full || (firstWord.length >= 2 && label === firstWord)) {
      return t.slice(bracket[0].length).replace(/^\s+/, "");
    }
  }

  const atFull = new RegExp(`^@${escapeRegex(name)}(?=\\s|[,.!?…]|$)\\s*`, "iu");
  if (atFull.test(t)) return t.replace(atFull, "").replace(/^\s+/, "");

  const first = name.split(/\s+/)[0] ?? "";
  if (first.length >= 2) {
    const atFirst = new RegExp(`^@${escapeRegex(first)}(?=\\s|[,.!?…]|$)\\s*`, "iu");
    if (atFirst.test(t)) return t.replace(atFirst, "").replace(/^\s+/, "");
  }

  return text;
}
