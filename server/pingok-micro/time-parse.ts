/**
 * Парсинг времени напоминания из русской фразы (эвристика, без LLM).
 * Интерпретация «в 15:30» — локальное время сервера (рекомендуется TZ=Europe/Moscow на VPS).
 */

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function stripIntentPrefix(s: string): string {
  return collapseSpaces(
    s.replace(
      /^(?:эй\s*,?\s*)?(?:слушай\s+)?(?:пинг\s*[,.]?\s*)?/i,
      "",
    )
      .replace(
        /^(?:напомни|напомнить|напоминание|запланируй|запланировать|план|задача|добавь\s+задачу|новая\s+задача|поставь\s+задачу)\s*[,:]?\s*/i,
        "",
      ),
  );
}

function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60_000);
}

function addHours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 3_600_000);
}

function atLocalClock(now: Date, hour: number, minute: number, dayOffset: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Если время сегодня уже прошло — перенос на завтра. */
function nextOccurrenceOfClock(now: Date, hour: number, minute: number): Date {
  let d = atLocalClock(now, hour, minute, 0);
  if (d.getTime() <= now.getTime()) {
    d = atLocalClock(now, hour, minute, 1);
  }
  return d;
}

export type ParsedFireAt = { fireAt: Date; title: string };

export function parseRussianReminderTime(raw: string, now: Date): ParsedFireAt | { error: string } {
  let s = stripIntentPrefix(raw);
  if (!s) {
    return { error: "Не удалось понять текст. Скажите, например: «напомни через 20 минут купить хлеб»." };
  }

  let matched = false;
  let fireAt: Date | null = null;
  let consumed = "";

  const tryRelMin = /^через\s+(\d+)\s*мин(?:ут(?:ы)?)?(?=\s|$)/i.exec(s);
  if (tryRelMin) {
    const n = parseInt(tryRelMin[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 60 * 24 * 14) {
      fireAt = addMinutes(now, n);
      consumed = tryRelMin[0];
      matched = true;
    }
  }

  if (!matched && /через\s+полчаса/i.test(s)) {
    fireAt = addMinutes(now, 30);
    consumed = s.match(/через\s+полчаса/i)![0];
    matched = true;
  }

  if (!matched) {
    const tryRelH = /^через\s+(\d+)\s*час(?:а|ов)?(?=\s|$)/i.exec(s);
    if (!tryRelH) {
      const tryRelH2 = /^через\s+(\d+)\s*ч\.?(?=\s|$)/i.exec(s);
      if (tryRelH2) {
        const n = parseInt(tryRelH2[1], 10);
        if (Number.isFinite(n) && n > 0 && n < 168) {
          fireAt = addHours(now, n);
          consumed = tryRelH2[0];
          matched = true;
        }
      }
    } else {
      const n = parseInt(tryRelH[1], 10);
      if (Number.isFinite(n) && n > 0 && n < 168) {
        fireAt = addHours(now, n);
        consumed = tryRelH[0];
        matched = true;
      }
    }
  }

  const timeInPhrase = (base: string, dayOffset: number): boolean => {
    const m = /(?:^|\s)(?:в|на|к)\s+(\d{1,2})(?:[.:](\d{2}))?(?=\s|$)/i.exec(base);
    if (!m) return false;
    const h = parseInt(m[1], 10);
    const min = m[2] != null ? parseInt(m[2], 10) : 0;
    if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(min) || min < 0 || min > 59) return false;
    let d = atLocalClock(now, h, min, dayOffset);
    if (dayOffset === 0 && d.getTime() <= now.getTime()) {
      d = atLocalClock(now, h, min, 1);
    }
    fireAt = d;
    consumed = m[0];
    return true;
  };

  if (!matched && /(?:^|\s)завтра(?=\s|$)/i.test(s)) {
    const rest = s.replace(/(?:^|\s)завтра(?=\s|$)/i, " ").trim();
    if ((/(?:^|\s)(?:в|на|к)\s+\d/i.test(rest) || /(?:^|\s)\d{1,2}[.:]\d{2}(?=\s|$)/.test(rest)) && timeInPhrase(rest, 1)) {
      matched = true;
    } else {
      const bare = /(?:^|\s)(\d{1,2})[.:](\d{2})(?=\s|$)/.exec(rest);
      if (bare) {
        const h = parseInt(bare[1], 10);
        const min = parseInt(bare[2], 10);
        if (Number.isFinite(h) && h >= 0 && h <= 23 && Number.isFinite(min) && min >= 0 && min <= 59) {
          fireAt = atLocalClock(now, h, min, 1);
          consumed = bare[0];
          matched = true;
        }
      }
    }
    if (!matched) {
      fireAt = atLocalClock(now, 9, 0, 1);
      consumed = "завтра";
      matched = true;
    }
  }

  if (!matched && /(?:^|\s)сегодня(?=\s|$)/i.test(s)) {
    const rest = s.replace(/(?:^|\s)сегодня(?=\s|$)/i, " ").trim();
    if (timeInPhrase(rest, 0)) {
      matched = true;
    } else {
      const bare = /(?:^|\s)(\d{1,2})[.:](\d{2})(?=\s|$)/.exec(rest);
      if (bare) {
        const h = parseInt(bare[1], 10);
        const min = parseInt(bare[2], 10);
        if (Number.isFinite(h) && h >= 0 && h <= 23 && Number.isFinite(min) && min >= 0 && min <= 59) {
          let d = atLocalClock(now, h, min, 0);
          if (d.getTime() <= now.getTime()) d = atLocalClock(now, h, min, 1);
          fireAt = d;
          consumed = bare[0];
          matched = true;
        }
      }
    }
  }

  if (!matched) {
    const mClockPrep = /(?:^|\s)(?:в|на|к)\s+(\d{1,2})(?:[.:](\d{2}))?(?=\s|$)/i.exec(s);
    if (mClockPrep) {
      const h = parseInt(mClockPrep[1], 10);
      const min = mClockPrep[2] != null ? parseInt(mClockPrep[2], 10) : 0;
      if (Number.isFinite(h) && h >= 0 && h <= 23 && Number.isFinite(min) && min >= 0 && min <= 59) {
        fireAt = nextOccurrenceOfClock(now, h, min);
        consumed = mClockPrep[0];
        matched = true;
      }
    }
  }

  if (!matched) {
    const mClockBare = /(?:^|\s)(\d{1,2})[.:](\d{2})(?=\s|$)/.exec(s);
    if (mClockBare) {
      const h = parseInt(mClockBare[1], 10);
      const min = parseInt(mClockBare[2], 10);
      if (Number.isFinite(h) && h >= 0 && h <= 23 && Number.isFinite(min) && min >= 0 && min <= 59) {
        fireAt = nextOccurrenceOfClock(now, h, min);
        consumed = mClockBare[0];
        matched = true;
      }
    }
  }

  if (!matched || !fireAt) {
    return {
      error:
        "Не удалось понять время. Скажите: «через 15 минут», «через 2 часа», «в 18:30» или «завтра в 9».",
    };
  }

  let title = collapseSpaces(
    s
      .replace(consumed, "")
      .replace(/(?:^|\s)завтра(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)сегодня(?=\s|$)/gi, " "),
  );
  title = stripIntentPrefix(title);
  if (!title) title = "Напоминание";

  return { fireAt, title };
}

export function extractTaskTitle(raw: string): string {
  let s = stripIntentPrefix(raw);
  s = collapseSpaces(
    s.replace(/^(?:добавь|поставь|создай|новая)\s+задач(?:у|и)\s*[,:]?\s*/i, "").replace(/^задача\s*[,:]?\s*/i, ""),
  );
  return s || "Задача";
}

export function extractCallTaskTitle(raw: string): string {
  let s = stripIntentPrefix(raw);
  s = collapseSpaces(
    s
      .replace(/^(?:позвони|позвонить|набери|перезвони|перезвонить|созвон(?:иться)?)\s*/i, "")
      .replace(/(?:^|\s)(?:сегодня|завтра)(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)через\s+\d+\s*(?:мин(?:ут(?:ы)?)?|час(?:а|ов)?|ч\.?)(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)в\s+\d{1,2}(?:[.:]\d{2})?(?=\s|$)/gi, " "),
  );
  s = collapseSpaces(s);
  return s ? `Позвонить ${s}` : "Позвонить";
}

export type ParsedDm = { nameQuery: string; messageText: string } | { error: string };

export function parseVoiceDmCommand(raw: string): ParsedDm {
  const s = stripIntentPrefix(raw).replace(/^(?:сообщение|sms)\s+/i, "");
  const mThat =
    /^(?:напиши|написать|отправь(?:те)?|скажи|сообщение|передай)\s+(.+?)\s+что\s+([\s\S]+)$/i.exec(s);
  if (mThat) {
    return { nameQuery: collapseSpaces(mThat[1]), messageText: collapseSpaces(mThat[2]) };
  }
  const mDash =
    /^(?:напиши|написать|отправь(?:те)?|скажи|передай)\s+(.+?)\s*[—–\-:,]\s+([\s\S]{2,})$/i.exec(s);
  if (mDash) {
    return { nameQuery: collapseSpaces(mDash[1]), messageText: collapseSpaces(mDash[2]) };
  }
  const stripped = s.replace(
    /^(?:напиши|написать|отправь(?:те)?|скажи|передай)\s+/i,
    "",
  ).trim();
  const words = stripped.split(/\s+/).filter(Boolean);
  if (words.length === 2) {
    return { nameQuery: collapseSpaces(words[0]!), messageText: collapseSpaces(words[1]!) };
  }
  if (words.length === 3) {
    return {
      nameQuery: collapseSpaces(`${words[0]} ${words[1]}`),
      messageText: collapseSpaces(words[2]!),
    };
  }
  if (words.length >= 4) {
    return {
      nameQuery: collapseSpaces(words.slice(0, 2).join(" ")),
      messageText: collapseSpaces(words.slice(2).join(" ")),
    };
  }
  return {
    error:
      "Скажите так: «Напиши Ивану что я задержусь», «Напиши Мария Иванова — привет» или «Напиши Оле спасибо».",
  };
}

/** Задача в трек: «запиши в трек дневник — купить масло», «в трек работа: сделать отчёт». */
export type ParsedTrackTask = { trackName: string; itemText: string };

export function parseVoiceTrackTaskCommand(raw: string): ParsedTrackTask | null {
  const s = stripIntentPrefix(raw).trim();
  if (!/(?:\bтрек\b|в\s+трек)/i.test(s)) return null;

  const m1 =
    /^(?:запиши|добавь|поставь|создай)\s+(?:в\s+)?трек\s+(.+?)\s*[—–\-:]\s*([\s\S]{2,})$/i.exec(s);
  if (m1) {
    return { trackName: collapseSpaces(m1[1]), itemText: collapseSpaces(m1[2]) };
  }
  const m2 = /^в\s+трек\s+(.+?)\s*[—–\-:]\s*([\s\S]{2,})$/i.exec(s);
  if (m2) {
    return { trackName: collapseSpaces(m2[1]), itemText: collapseSpaces(m2[2]) };
  }
  const m3 =
    /^(?:запиши|добавь|поставь)\s+в\s+трек\s+(.+?)\s+([\s\S]{3,})$/i.exec(s);
  if (m3) {
    return { trackName: collapseSpaces(m3[1]), itemText: collapseSpaces(m3[2]) };
  }
  return null;
}

export type ParsedVoiceCall =
  | { nameQuery: string; media: "audio" | "video" }
  | { error: string };

function stripSchedulingFragments(s: string): string {
  return collapseSpaces(
    s
      .replace(/(?:^|\s)(?:на|в|к)\s+\d{1,2}(?:[.:]\d{2})?(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)(?:сегодня|завтра|послезавтра)(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)через\s+\d+\s*(?:мин(?:ут(?:ы)?)?|час(?:а|ов)?|ч\.?)(?=\s|$)/gi, " ")
      .replace(/(?:^|\s)(?:утром|днем|днём|вечером|ночью|потом)(?=\s|$)/gi, " "),
  );
}

function cleanupCallTarget(raw: string): string {
  let s = collapseSpaces(raw)
    .replace(/^[,.;:!?-]+\s*/g, "")
    .replace(/\s*[,.;:!?-]+$/g, "")
    .replace(/^(?:с|к)\s+/i, "")
    .replace(/(?:^|\s)(?:сейчас|щас|прямо\s+сейчас)(?=\s|$)/gi, " ")
    .replace(/(?:^|\s)(?:по\s+видео|видео)(?=\s|$)/gi, " ");
  s = stripSchedulingFragments(s);
  s = collapseSpaces(s);
  return s;
}

function detectCallMedia(raw: string): "audio" | "video" {
  return /(?:^|\s)(?:по\s+видео|видео|видеозвон|видеозвонок|video)(?=\s|$)/i.test(raw) ? "video" : "audio";
}

/** «Перенеси звонок на …», «передвинь звонок с Марией на …» */
export function looksLikeVoiceCallReschedule(raw: string): boolean {
  const s = raw.toLowerCase();
  return (
    /(?:перенеси|перенести|передвинь|передвинуть|сдвинь|сдвинуть)/i.test(s) &&
    /звон/i.test(s)
  );
}

export function looksLikeVoiceCallCancel(raw: string): boolean {
  const s = raw.toLowerCase();
  return (
    /(?:отмени|отменить|убери|убрать)\s+(?:запланированн(?:ый|ого)\s+)?звон/i.test(s) ||
    /(?:отмени|отменить)\s+план\s+на\s+звон/i.test(s)
  );
}

/** «отмени звонок с Марией» → имя; иначе null (ближайший активный). */
export function parseVoiceCallCancelNameQuery(raw: string): string | null {
  const s = stripIntentPrefix(raw);
  const m = /звон(?:ок)?\s+с\s+([\s\S]{2,})$/i.exec(s);
  if (m?.[1]) return collapseSpaces(m[1]);
  return null;
}

export type ParsedCallReschedule = { nameQuery: string | null; timePhrase: string };

export function parseVoiceCallRescheduleFragment(raw: string): ParsedCallReschedule | { error: string } {
  let s = stripIntentPrefix(raw);
  s = collapseSpaces(
    s.replace(
      /^(?:перенеси|перенести|передвинь|передвинуть|сдвинь|сдвинуть)\s+(?:мой|наш)?\s*звон(?:ок)?\s*/i,
      "",
    ),
  );
  const mWith = /^с\s+(.+?)\s+на\s+([\s\S]+)$/i.exec(s);
  if (mWith) {
    return { nameQuery: collapseSpaces(mWith[1]), timePhrase: collapseSpaces(mWith[2]) };
  }
  const mOn = /^на\s+([\s\S]+)$/i.exec(s);
  if (mOn) {
    return { nameQuery: null, timePhrase: collapseSpaces(mOn[1]) };
  }
  if (!s.trim()) {
    return { error: "Скажите, например: «перенеси звонок на завтра в 10» или «перенеси звонок с Иваном на через час»." };
  }
  return { nameQuery: null, timePhrase: s };
}

export function parseVoiceCallCommand(raw: string): ParsedVoiceCall {
  const source = stripIntentPrefix(raw);
  const media = detectCallMedia(source);
  const s = collapseSpaces(source);

  const mVerb = /^(?:позвони|позвонить|набери|набрать|набери|перезвони|перезвонить|созвонись|созвониться)\s+([\s\S]+)$/i.exec(
    s,
  );
  if (mVerb) {
    const nameQuery = cleanupCallTarget(mVerb[1]);
    if (!nameQuery) return { error: "Назовите, кому звонить: «позвони Илоне» или «позвони по видео Илоне»." };
    return { nameQuery, media };
  }

  const mVideoFirst = /^(?:по\s+видео\s+)?(?:видео\s*звонок|видеозвон(?:ок)?)\s+([\s\S]+)$/i.exec(s);
  if (mVideoFirst) {
    const nameQuery = cleanupCallTarget(mVideoFirst[1]);
    if (!nameQuery) return { error: "Назовите, кому звонить по видео." };
    return { nameQuery, media: "video" };
  }

  return {
    error:
      "Скажите так: «позвони Илоне», «набери Путину», «позвони по видео Илоне».",
  };
}
