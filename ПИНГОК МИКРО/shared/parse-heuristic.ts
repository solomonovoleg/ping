import type { PingokMicroParseRequest, PingokMicroParseResponse } from "./command-types";
import { buildTranscriptCandidates, normalizeTranscriptForCommand } from "./transcript-fuzzy";

function detectIntent(lower: string): PingokMicroParseResponse["intent"] {
  if (/(^|\s)(найди|найти|поиск|где\s|отыщи|отыскать|в\s+сообщениях|в\s+переписке)/i.test(lower)) return "find";
  if (/(напиши|написать|сообщен|отправь|отправить|передай|скажи\s+.*\s+что)/i.test(lower)) return "message";
  if (/(запланируй|запланировать|план|добавь\s+в\s+план|в\s+план)/i.test(lower)) return "plan";
  if (
    /(позвони|позвонить|позвоню|созвон|созвониться|набери|наберу|перезвони|перезвонить|видео\s*звон|видеозвон|call\b)/i.test(
      lower,
    )
  ) {
    return "call";
  }
  if (/(встреч[ауи]|созвон\s+на)/i.test(lower)) return "plan";
  if (/(задач|todo|туду|to\s*do|сделай\s+задач|добавь\s+задач|поставь\s+задач|\bтрек\b|в\s+трек|запиши\s+в\s+трек)/i.test(lower)) {
    return "task";
  }
  if (/(напомни|напомнить|напоминан)/i.test(lower)) return /напомни/i.test(lower) ? "remind" : "task";
  if (/(покажи|показать|открой|открыть|выведи)/i.test(lower)) return "show";
  return "unknown";
}

/**
 * Эвристический разбор без LLM. Общий для основного API и отдельного процесса ПИНГОК МИКРО.
 */
export function parsePingokCommandHeuristic(body: PingokMicroParseRequest): PingokMicroParseResponse {
  const raw = typeof body.text === "string" ? body.text.trim() : "";
  const commandText = normalizeTranscriptForCommand(raw) || raw;

  let intent: PingokMicroParseResponse["intent"] = "unknown";
  for (const candidate of buildTranscriptCandidates(raw)) {
    const lower = candidate.toLowerCase().replace(/ё/g, "е");
    intent = detectIntent(lower);
    if (intent !== "unknown") break;
  }

  return {
    intent,
    commandText,
    reply:
      intent === "unknown"
        ? "Команда распознана, сценарий подключим на следующем шаге."
        : `Принял намерение «${intent}». Дальше — исполнение в основном приложении.`,
    slots: {},
  };
}
