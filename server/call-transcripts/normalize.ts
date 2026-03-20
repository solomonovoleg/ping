export function normalizeTranscriptText(text: string, isFinal: boolean): string {
  const compact = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  if (!compact) return "";
  const first = compact.slice(0, 1).toUpperCase() + compact.slice(1);
  if (!isFinal) return first;
  return /[.!?…]$/.test(first) ? first : `${first}.`;
}
