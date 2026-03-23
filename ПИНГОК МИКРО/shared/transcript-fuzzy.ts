/**
 * Нормализация голосового текста (STT): шум, слова-паразиты, повторы букв,
 * варианты фраз для повторного определения намерения.
 */

const FILLER_RE =
  /\b(ну|ну\s+вот|ээ+|э+|мм+|эм+|типа|короче|как\s*бы|блин|знаешь|понимаешь|вот|собственно|буквально|кстати|слушай|смотри|это\s+самое|короче\s+говоря)\b/giu;

const LEADING_NOISE_RE = /^(?:[\s,.;:!?\-–—]+)*(?:ну|ээ+|э+|мм+|эм+|вот|так|значит|слушай|смотри)[\s,.;:!?\-–—]*/giu;

function collapseRepeatedChars(s: string): string {
  return s.replace(/(.)\1{2,}/gu, "$1$1");
}

/**
 * Чистый текст для исполнения команды (один канонический вариант).
 */
export function normalizeTranscriptForCommand(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/ё/g, "е");
  s = collapseRepeatedChars(s);
  s = s.replace(FILLER_RE, " ");
  s = s.replace(LEADING_NOISE_RE, "");
  s = s.replace(/[.,!?;:()[\]{}"'`~*_/\\|+-]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function slidingPrefixesDropped(text: string, maxDrop: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const limit = Math.min(maxDrop, Math.max(0, words.length - 1));
  for (let drop = 1; drop <= limit; drop++) {
    const slice = words.slice(drop).join(" ");
    if (slice.length >= 2) out.push(slice);
  }
  return out;
}

/**
 * Варианты строки для эвристики intent: STT часто добавляет мусор в начало.
 */
export function buildTranscriptCandidates(raw: string): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const ordered: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if (t.length < 2) return;
    const key = t.toLowerCase().replace(/ё/g, "е");
    if (seen.has(key)) return;
    seen.add(key);
    ordered.push(t);
  };

  const normalized = normalizeTranscriptForCommand(trimmed);
  add(trimmed);
  if (normalized && normalized !== trimmed) add(normalized);

  const strippedLead = trimmed.replace(LEADING_NOISE_RE, "").trim();
  if (strippedLead && strippedLead !== trimmed) {
    add(strippedLead);
    const n2 = normalizeTranscriptForCommand(strippedLead);
    if (n2 && n2 !== strippedLead) add(n2);
  }

  for (const tail of slidingPrefixesDropped(normalized || trimmed, 5)) {
    add(tail);
    const nt = normalizeTranscriptForCommand(tail);
    if (nt && nt !== tail) add(nt);
  }

  return ordered;
}
