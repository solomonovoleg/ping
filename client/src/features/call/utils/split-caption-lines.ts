/**
 * Дробит длинный финальный фрагмент Web Speech в короткие строки для титров.
 */
export function splitTranscriptToCaptionLines(text: string, maxLen = 64): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];

  const chunks: string[] = [];
  const sentences = t.split(/(?<=[.!?…])\s+/u).map((s) => s.trim()).filter(Boolean);

  const pushWrapped = (segment: string) => {
    let rest = segment;
    while (rest.length > maxLen) {
      const slice = rest.slice(0, maxLen);
      const sp = slice.lastIndexOf(" ");
      const cut = sp > 24 ? sp : maxLen;
      const part = rest.slice(0, cut).trim();
      if (part) chunks.push(part);
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  };

  if (sentences.length === 0) {
    pushWrapped(t);
    return chunks;
  }

  for (const s of sentences) {
    if (s.length <= maxLen) chunks.push(s);
    else pushWrapped(s);
  }

  return chunks.length > 0 ? chunks : [t];
}
