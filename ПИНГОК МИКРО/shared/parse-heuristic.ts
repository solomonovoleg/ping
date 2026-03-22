import type { PingokMicroParseRequest, PingokMicroParseResponse } from "./command-types";

/**
 * Эвристический разбор без LLM. Общий для основного API и отдельного процесса ПИНГОК МИКРО.
 */
export function parsePingokCommandHeuristic(body: PingokMicroParseRequest): PingokMicroParseResponse {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const lower = text.toLowerCase();
  let intent: PingokMicroParseResponse["intent"] = "unknown";
  if (/(^|\s)(найди|найти|поиск|где\s|отыщи|отыскать|в\s+сообщениях|в\s+переписке)/i.test(lower)) intent = "find";
  else if (/(напиши|написать|сообщен|отправь|отправить|передай|скажи\s+.*\s+что)/i.test(lower)) intent = "message";
  else if (/(запланируй|запланировать|план|добавь\s+в\s+план|в\s+план)/i.test(lower)) {
    intent = "plan";
  }
  else if (
    /(позвони|позвонить|позвоню|созвон|созвониться|набери|наберу|перезвони|перезвонить|видео\s*звон|видеозвон|call\b)/i.test(
      lower,
    )
  ) {
    intent = "call";
  } else if (/(встреч[ауи]|созвон\s+на)/i.test(lower)) {
    intent = "plan";
  } else if (/(задач|todo|туду|to\s*do|сделай\s+задач|добавь\s+задач|поставь\s+задач)/i.test(lower)) {
    intent = "task";
  } else if (/(напомни|напомнить|напоминан)/i.test(lower)) {
    intent = /напомни/i.test(lower) ? "remind" : "task";
  } else if (/(покажи|показать|открой|открыть|выведи)/i.test(lower)) intent = "show";

  return {
    intent,
    commandText: text,
    reply:
      intent === "unknown"
        ? "Команда распознана, сценарий подключим на следующем шаге."
        : `Принял намерение «${intent}». Дальше — исполнение в основном приложении.`,
    slots: {},
  };
}
