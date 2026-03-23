import type { PingokMicroIntent, PingokMicroParseResponse } from "./command-types";

function detectIntent(text: string): PingokMicroIntent {
  const t = text.toLowerCase().trim();

  if (!t) return "other";

  if (/(?:найди|поиск|вспомни|где я писал|в переписк)/i.test(t)) {
    return "memory_search";
  }

  if (/(?:позвон|набери|созвон|видео.?звон|аудио.?звон|звонок)/i.test(t)) {
    return "call";
  }

  if (/(?:напомни|напоминание|напомнить|к\s+\d{1,2}(?::\d{2})?)/i.test(t)) {
    return "remind";
  }

  if (/(?:запланируй|в план|добавь в план|план на)/i.test(t)) {
    return "plan";
  }

  if (/(?:задач|to do|todo|сделать|нужно|\bтрек\b|в\s+трек|запиши\s+в\s+трек)/i.test(t)) {
    return "task";
  }

  if (/(?:напиши|отправь|сообщение|пиши)/i.test(t)) {
    return "message";
  }

  return "other";
}

export function parsePingokCommandHeuristic(input: { text: string }): PingokMicroParseResponse {
  const commandText = (input.text ?? "").trim();
  return {
    intent: detectIntent(commandText),
    commandText,
  };
}
