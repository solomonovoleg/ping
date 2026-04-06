/**
 * Активное @-слово сразу перед курсором: только буквы/цифры/_ (как токен для поиска и public id).
 */
const AT_TOKEN = /@([\wа-яёА-ЯЁ0-9_]*)$/u;

export type AtTokenMatch = {
  query: string;
  replaceFrom: number;
  replaceTo: number;
};

export function parseAtTokenBeforeCursor(text: string, selectionStart: number): AtTokenMatch | null {
  const before = text.slice(0, selectionStart);
  const m = AT_TOKEN.exec(before);
  if (!m) return null;
  const full = m[0];
  const replaceFrom = before.length - full.length;
  return {
    query: m[1] ?? "",
    replaceFrom,
    replaceTo: selectionStart,
  };
}
