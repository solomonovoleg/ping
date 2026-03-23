import type { PingokExecuteCandidate } from "./pingok-micro-api";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,!?;:()[\]{}"'`~*_/\\|+-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Для коротких ответов STT (да/нет/ок) — допускаем 1 опечатку. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = cur;
    }
  }
  return row[n]!;
}

const YES_TOKENS = [
  "да",
  "ага",
  "угу",
  "ок",
  "окей",
  "ладно",
  "верно",
  "точно",
  "давай",
  "конечно",
  "хорошо",
  "подтверждаю",
  "отправляй",
  "отправь",
  "согласен",
  "согласна",
  "именно",
  "правильно",
];

const NO_TOKENS = ["нет", "неа", "неверно", "отмена", "отмени", "другой", "другая"];

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
  if (w.length > 6) out.add(w.slice(0, -3));
  if (w.endsWith("е") || w.endsWith("у") || w.endsWith("ю")) out.add(w.slice(0, -1) + "а");
  if (w.endsWith("и") || w.endsWith("е")) out.add(w.slice(0, -1) + "я");
  if (w.endsWith("ой") || w.endsWith("ом")) out.add(w.slice(0, -2) + "а");
  if (w.endsWith("ам") || w.endsWith("ах")) out.add(w.slice(0, -2));
  return Array.from(out);
}

export function isVoiceYes(text: string): boolean {
  const n = normalize(text);
  if (
    /(?:^|[\s,.;])(да|ага|угу|подтверждаю|верно|точно|отправляй|отправь|ок|окей|ладно|хорошо|давай|конечно|согласен|согласна|правильно|именно|так|всё\s+верно|все\s+верно)(?:$|[\s,.;!?])/i.test(
      n,
    )
  ) {
    return true;
  }
  if (/\bда\b/i.test(n) && !/\bне\s+да\b/i.test(n) && !/\bнеда\b/i.test(n)) return true;

  const compact = n.replace(/\s+/g, "");
  if (compact.length > 0 && compact.length <= 14) {
    for (const y of YES_TOKENS) {
      if (levenshtein(compact, y) <= 1) return true;
    }
  }
  const words = n.split(" ").filter((w) => w.length > 0);
  for (const w of words) {
    if (w.length > 12) continue;
    for (const y of YES_TOKENS) {
      if (y.length <= 2 && w.length > 4) continue;
      if (levenshtein(w, y) <= 1) return true;
    }
  }
  return false;
}

export function isVoiceNo(text: string): boolean {
  const n = normalize(text);
  if (
    /(?:^|[\s,.;])(нет|неа|неверно|отмена|отмени|не\s+нужно|не\s+надо|другой|другая|не\s+тот|не\s+та)(?:$|[\s,.;!?])/i.test(
      n,
    )
  ) {
    return true;
  }
  const compact = n.replace(/\s+/g, "");
  if (compact.length > 0 && compact.length <= 12) {
    for (const x of NO_TOKENS) {
      if (levenshtein(compact, x) <= 1) return true;
    }
  }
  const words = n.split(" ").filter((w) => w.length > 0);
  for (const w of words) {
    if (w.length > 10) continue;
    for (const x of NO_TOKENS) {
      if (x.length <= 3 && w.length > 6) continue;
      if (levenshtein(w, x) <= 1) return true;
    }
  }
  return false;
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
      else if (r.length >= 3 && r.length <= 14) {
        for (const part of label.split(" ")) {
          if (part.length < 3) continue;
          if (levenshtein(r, part) <= 1) score += 10;
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}
