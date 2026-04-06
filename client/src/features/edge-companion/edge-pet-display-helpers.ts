/** Чистые функции для UI персонажа EDGE (без React). */

export type HungerLevel = "ok" | "soon" | "hungry";

export function getHungerLevel(lastFedAt: string | null, happyScore: number): HungerLevel {
  if (happyScore < 32) return "hungry";
  if (!lastFedAt) return "hungry";
  const t = new Date(lastFedAt).getTime();
  if (Number.isNaN(t)) return "soon";
  const hours = (Date.now() - t) / 3_600_000;
  if (hours >= 8) return "hungry";
  if (hours >= 4) return "soon";
  return "ok";
}

export function hungerBadgeLabel(level: HungerLevel): string | null {
  if (level === "hungry") return "Голоден";
  if (level === "soon") return "Пора кормить";
  return null;
}

/** 0–5 заполненных точек настроения. */
export function moodDotsFilled(happyScore: number): number {
  return Math.round((Math.min(100, Math.max(0, happyScore)) / 100) * 5);
}

export function speechLine(mood: string, hunger: HungerLevel): string {
  if (hunger === "hungry") return "Нужна помощь…";
  if (mood === "happy") return "Ура, так весело!";
  if (mood === "sad") return "Мне грустно…";
  return "Нормально. Уделите внимание";
}

/** Подсказка по `careDeadlineAt` с EDGE (8 ч после последнего корма / входа). */
export function formatCareDeadlineHint(iso: string | null): string | null {
  if (!iso) return "Комфортное окно корма: можно кормить";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const ms = t - Date.now();
  if (ms <= 0) return "Комфортное окно корма: можно кормить";
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `До идеального корма ~${min} мин`;
  const h = Math.ceil(min / 60);
  if (h < 72) return `До идеального корма ~${h} ч`;
  return "До комфортного корма ещё больше трёх суток";
}

export function formatLastFedShort(iso: string | null): string {
  if (!iso) return "ещё не кормили";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMin = Math.max(0, Math.floor((Date.now() - t) / 60_000));
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}

/**
 * Прогресс к следующему уровню: полоса внутри [level×100, (level+1)×100).
 * Совпадает с правилом level на сервере EDGE (шаг 100 XP на уровень).
 */
/** Короткий статус для карточки: сон vs бодрствование (по mood + happyScore). */
export function edgeVitalityLabel(
  mood: string,
  happyScore: number,
): { label: string; tone: "sleep" | "awake" | "calm" } {
  const h = Math.min(100, Math.max(0, happyScore));
  if (h < 32 || mood === "sad") {
    return { label: "Спит", tone: "sleep" };
  }
  if (mood === "happy" && h >= 58) {
    return { label: "Бодрствует", tone: "awake" };
  }
  if (h >= 48) {
    return { label: "Бодрствует", tone: "awake" };
  }
  return { label: "Спокоен", tone: "calm" };
}

export function xpProgressWithinLevel(xp: number, level: number): { pct: number; toNext: number } {
  const safeXp = Math.max(0, xp);
  const safeLevel = Math.max(0, level);
  const low = safeLevel * 100;
  const high = (safeLevel + 1) * 100;
  const span = high - low;
  const into = Math.max(0, Math.min(span, safeXp - low));
  const pct = span <= 0 ? 0 : Math.round((into / span) * 100);
  const toNext = Math.max(0, high - safeXp);
  return { pct, toNext };
}
