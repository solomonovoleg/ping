import type { PingokExecuteCandidate } from "./pingok-micro-api";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()[\]{}"'`~*_/\\|+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNumberishWord(s: string): number | null {
  const n = normalize(s);
  const d = n.match(/(?:^|\s)([1-9])(?=\s|$)/);
  if (d) return parseInt(d[1], 10);
  if (/(?:^|\s)перв(ый|ую|ое|ого)(?=\s|$)/.test(n)) return 1;
  if (/(?:^|\s)втор(ой|ую|ое|ого)(?=\s|$)/.test(n)) return 2;
  if (/(?:^|\s)трет(ий|ью|ье|ьего)(?=\s|$)/.test(n)) return 3;
  if (/(?:^|\s)четверт(ый|ую|ое|ого)(?=\s|$)/.test(n)) return 4;
  if (/(?:^|\s)пят(ый|ую|ое|ого)(?=\s|$)/.test(n)) return 5;
  return null;
}

function withRoots(word: string): string[] {
  const w = normalize(word).replace(/\s+/g, "");
  if (!w) return [];
  const out = new Set<string>([w]);
  if (w.length > 4) out.add(w.slice(0, -1));
  if (w.length > 5) out.add(w.slice(0, -2));
  if (w.endsWith("е") || w.endsWith("у")) out.add(w.slice(0, -1) + "а");
  if (w.endsWith("и") || w.endsWith("е")) out.add(w.slice(0, -1) + "я");
  return Array.from(out);
}

export function isVoiceYes(text: string): boolean {
  const n = normalize(text);
  return /(?:^|\s)(да|ага|подтверждаю|верно|точно|отправляй|ок|окей)(?=\s|$)/.test(n);
}

export function isVoiceNo(text: string): boolean {
  const n = normalize(text);
  return /(?:^|\s)(нет|неа|неверно|отмена|отмени|не нужно|другой)(?=\s|$)/.test(n);
}

export function pickCandidateFromVoice(
  text: string,
  candidates: PingokExecuteCandidate[],
): PingokExecuteCandidate | null {
  if (candidates.length === 0) return null;
  const idx = isNumberishWord(text);
  if (idx && idx >= 1 && idx <= candidates.length) return candidates[idx - 1] ?? null;

  const n = normalize(text);
  if (!n) return null;
  const roots = n.split(" ").flatMap(withRoots);
  let best: { c: PingokExecuteCandidate; score: number } | null = null;
  for (const c of candidates) {
    const label = normalize([c.displayName, c.surname].filter(Boolean).join(" "));
    if (!label) continue;
    let score = 0;
    for (const r of roots) {
      if (!r || r.length < 2) continue;
      if (label === r) score += 20;
      else if (label.startsWith(r)) score += 12;
      else if (label.includes(r)) score += 8;
    }
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}
