import { PINGOK_WAKE_PHRASES } from "../shared/command-types";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:«»"""'''„"]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripWakePhrase(raw: string): { hadWake: boolean; commandText: string } {
  const n = normalize(raw);
  const compact = n.replace(/\s+/g, "");
  const wakeRegex = /(?:^|\s)(?:эй|окей|слушай)?\s*пин(?:г|к)(?:\s|$)/i;
  if (wakeRegex.test(n) || /(?:^|[^а-я])(эйпин(?:г|к)|окейпин(?:г|к)|слушайпин(?:г|к))/.test(compact)) {
    const stripped = n
      .replace(/^(?:ну\s+|а\s+|так\s+|короче\s+|ладно\s+|слушай\s+)?/i, "")
      .replace(/^(?:эй|окей|слушай)\s*пин(?:г|к)\s*/i, "")
      .replace(/^пин(?:г|к)\s*/i, "")
      .trim();
    return { hadWake: true, commandText: stripped };
  }
  for (const w of PINGOK_WAKE_PHRASES) {
    if (n === w || n.startsWith(`${w} `)) {
      return { hadWake: true, commandText: n.slice(w.length).trim() };
    }
  }
  return { hadWake: false, commandText: n };
}
