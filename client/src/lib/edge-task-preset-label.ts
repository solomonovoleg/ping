import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";
import type { PresetVerify } from "@shared/edge-task-preset-config";
import { hasObjectiveTaskVerify, needsEdgeVerify, needsPlatformVerify } from "@shared/edge-task-preset-config";

function ruTimesWord(n: number): "раз" | "раза" {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "раз";
  if (mod10 === 1) return "раз";
  if (mod10 >= 2 && mod10 <= 4) return "раза";
  return "раз";
}

function ruTimesPhrase(n: number): string {
  return `${n} ${ruTimesWord(n)}`;
}

function ruDaysWord(n: number): "день" | "дня" | "дней" {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function ruDaysPhrase(n: number): string {
  return `${n} ${ruDaysWord(n)}`;
}

/**
 * Подставляет в текст задания числа из `verify` (в т.ч. вместо шаблона «столько раз» / «несколько дней» из конструктора).
 */
export function formatEdgeTaskPresetLabel(label: string, verify: PresetVerify | undefined): string {
  if (!label?.trim() || !verify || verify.type === "honor") return label;

  let out = label;

  if ("minCount" in verify && typeof verify.minCount === "number") {
    const phrase = ruTimesPhrase(verify.minCount);
    out = out.replace(/столько\s+то\s+раз/gi, phrase);
    out = out.replace(/столько\s+раз/gi, phrase);
  }

  if (verify.type === "edge_game_login_streak" || verify.type === "edge_min_care_streak") {
    out = out.replace(/несколько\s+дней/gi, ruDaysPhrase(verify.minDays));
  }

  return out;
}

/**
 * Короткая подсказка для участника: что именно проверяется (без внутренних ключей задания).
 */
export function edgeTaskPresetVerifyHint(verify: PresetVerify | undefined): string | null {
  const v = verify ?? { type: "honor" as const };
  switch (v.type) {
    case "honor":
      return null;
    case "follow_creator":
      return "Нужно подписаться на автора кампании.";
    case "react_post":
      return "Нужно поставить реакцию на пост из этой кампании.";
    case "comment_post":
      return "Нужно оставить комментарий к посту кампании.";
    case "edge_min_level":
      return `Нужен как минимум ${v.minLevel} уровень персонажа.`;
    case "edge_min_xp":
      return `Нужно как минимум ${v.minXp} очков у персонажа.`;
    case "edge_min_care_streak":
      return `Нужна серия ухода ${v.minDays} дней подряд.`;
    case "ping_invited_users":
      return `Пригласите не меньше ${v.minCount} друзей. Пригласительные коды обычно можно запросить у автора кампании в личных сообщениях.`;
    case "edge_game_login_streak":
      return `Заходите в игру кампании ${ruDaysPhrase(v.minDays)} подряд.`;
    case "edge_game_daily_taps":
      return `Сделайте не меньше ${ruTimesPhrase(v.minCount)} тапов по персонажу за календарный день.`;
    case "edge_game_daily_feeds":
      return `Покормите питомца не меньше ${ruTimesPhrase(v.minCount)} за день.`;
    case "edge_game_daily_play":
      return `Поиграйте с питомцем не меньше ${ruTimesPhrase(v.minCount)} за день.`;
    case "edge_game_daily_toilet":
      return `Отведите питомца «в туалет» не меньше ${ruTimesPhrase(v.minCount)} за день.`;
    case "edge_game_daily_calm":
      return `Успокойте питомца не меньше ${ruTimesPhrase(v.minCount)} за день.`;
    case "edge_game_daily_pet":
      return `Погладьте питомца не меньше ${ruTimesPhrase(v.minCount)} за день.`;
    case "ping_posts_published":
      return `Опубликуйте в ленте не меньше ${ruTimesPhrase(v.minCount)} постов.`;
    case "ping_profile_complete":
      return "Заполните профиль в приложении по условию задания (дата рождения, фото и т.д.).";
    case "ping_comments_count":
      return `Оставьте не меньше ${ruTimesPhrase(v.minCount)} комментариев.`;
    case "ping_reactions_count":
      return `Поставьте не меньше ${ruTimesPhrase(v.minCount)} реакций.`;
    default:
      return null;
  }
}

/** Подпись срока для UI заданий (без технических ключей). */
export function edgeTaskPresetDeadlineCaption(deadlineDays: number): string | null {
  if (typeof deadlineDays !== "number" || deadlineDays < 1) return null;
  return `Срок: ${ruDaysPhrase(deadlineDays)} с первого входа в кампанию.`;
}

/** Короткая метка «где считается» для карточки пресетов (как в `EdgePresetTasksCard`). */
export function edgePresetTaskWhereLabel(p: Pick<EdgeTaskPresetPublic, "verify">): string | null {
  const v = p.verify;
  if (!v) return null;
  if (!hasObjectiveTaskVerify(v)) return "нет проверки";
  if (needsEdgeVerify(v)) return "в игре";
  if (needsPlatformVerify(v)) return "приложение";
  return null;
}
