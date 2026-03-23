/**
 * Пресеты заданий EDGE (`config_json.taskPresets`) — общие типы для EDGE и платформы.
 */

export type PresetVerify =
  | { type: "honor" }
  | { type: "follow_creator" }
  | { type: "react_post"; postId: string }
  | { type: "comment_post"; postId: string; minCount: number }
  | { type: "edge_min_level"; minLevel: number }
  | { type: "edge_min_xp"; minXp: number }
  | { type: "edge_min_care_streak"; minDays: number }
  /** Скрипты кампании (состояние в EDGE `character.extra` + события feed/interact). */
  | { type: "edge_game_login_streak"; minDays: number }
  | { type: "edge_game_daily_taps"; minCount: number }
  | { type: "edge_game_daily_feeds"; minCount: number }
  | { type: "edge_game_daily_play"; minCount: number }
  | { type: "edge_game_daily_toilet"; minCount: number }
  | { type: "edge_game_daily_calm"; minCount: number }
  | { type: "edge_game_daily_pet"; minCount: number }
  /** Глобальные скрипты PING (проверка на платформе). */
  | { type: "ping_invited_users"; minCount: number }
  | { type: "ping_posts_published"; minCount: number }
  | { type: "ping_profile_complete" }
  | { type: "ping_comments_count"; minCount: number }
  | { type: "ping_reactions_count"; minCount: number };

export type TaskPresetEntry = {
  key: string;
  label: string;
  points: number;
  penalty: number;
  deadlineDays: number;
  verify: PresetVerify;
};

const SCOPES = ["game", "global", "commercial"] as const;

export function parsePresetVerify(raw: unknown): PresetVerify {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { type: "honor" };
  const o = raw as Record<string, unknown>;
  const t = o.type;
  if (t === "follow_creator") return { type: "follow_creator" };
  if (t === "honor") return { type: "honor" };
  if (t === "react_post" && typeof o.postId === "string" && o.postId.trim()) {
    return { type: "react_post", postId: o.postId.trim() };
  }
  if (t === "comment_post" && typeof o.postId === "string" && o.postId.trim()) {
    const mc = o.minCount;
    const minCount =
      typeof mc === "number" && Number.isFinite(mc) && mc >= 1 ? Math.floor(mc) : 1;
    return { type: "comment_post", postId: o.postId.trim(), minCount };
  }
  if (t === "edge_min_level") {
    const n = o.minLevel;
    if (typeof n === "number" && Number.isFinite(n)) {
      return { type: "edge_min_level", minLevel: Math.max(1, Math.floor(n)) };
    }
  }
  if (t === "edge_min_xp") {
    const n = o.minXp;
    if (typeof n === "number" && Number.isFinite(n)) {
      return { type: "edge_min_xp", minXp: Math.max(0, Math.floor(n)) };
    }
  }
  if (t === "edge_min_care_streak") {
    const n = o.minDays;
    if (typeof n === "number" && Number.isFinite(n)) {
      return { type: "edge_min_care_streak", minDays: Math.max(1, Math.floor(n)) };
    }
  }

  const mc = o.minCount;
  const minCount =
    typeof mc === "number" && Number.isFinite(mc) && mc >= 1 ? Math.floor(mc) : 1;

  if (t === "edge_game_login_streak") {
    const n = o.minDays;
    const days =
      typeof n === "number" && Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
    return { type: "edge_game_login_streak", minDays: days };
  }
  if (t === "edge_game_daily_taps") return { type: "edge_game_daily_taps", minCount };
  if (t === "edge_game_daily_feeds") return { type: "edge_game_daily_feeds", minCount };
  if (t === "edge_game_daily_play") return { type: "edge_game_daily_play", minCount };
  if (t === "edge_game_daily_toilet") return { type: "edge_game_daily_toilet", minCount };
  if (t === "edge_game_daily_calm") return { type: "edge_game_daily_calm", minCount };
  if (t === "edge_game_daily_pet") return { type: "edge_game_daily_pet", minCount };

  if (t === "ping_invited_users") return { type: "ping_invited_users", minCount };
  if (t === "ping_posts_published") return { type: "ping_posts_published", minCount };
  if (t === "ping_profile_complete") return { type: "ping_profile_complete" };
  if (t === "ping_comments_count") return { type: "ping_comments_count", minCount };
  if (t === "ping_reactions_count") return { type: "ping_reactions_count", minCount };

  return { type: "honor" };
}

export function needsPlatformVerify(v: PresetVerify): boolean {
  return (
    v.type === "follow_creator" ||
    v.type === "react_post" ||
    v.type === "comment_post" ||
    v.type === "ping_invited_users" ||
    v.type === "ping_posts_published" ||
    v.type === "ping_profile_complete" ||
    v.type === "ping_comments_count" ||
    v.type === "ping_reactions_count"
  );
}

export function needsEdgeVerify(v: PresetVerify): boolean {
  return (
    v.type === "edge_min_level" ||
    v.type === "edge_min_xp" ||
    v.type === "edge_min_care_streak" ||
    v.type === "edge_game_login_streak" ||
    v.type === "edge_game_daily_taps" ||
    v.type === "edge_game_daily_feeds" ||
    v.type === "edge_game_daily_play" ||
    v.type === "edge_game_daily_toilet" ||
    v.type === "edge_game_daily_calm" ||
    v.type === "edge_game_daily_pet"
  );
}

function parsePresetItem(
  o: Record<string, unknown>,
  scope: (typeof SCOPES)[number],
  idx: number,
): TaskPresetEntry | null {
  const label = typeof o.label === "string" ? o.label.trim() : "";
  if (!label) return null;

  let key = typeof o.key === "string" ? o.key.trim() : "";
  if (!key) key = `${scope}_${idx}`;
  const legacy = /^task_(\d+)$/.exec(key);
  if (legacy) key = `${scope}_${legacy[1]}`;

  const points =
    typeof o.points === "number" && Number.isFinite(o.points) ? Math.floor(o.points) : 10;
  const penalty =
    typeof o.penalty === "number" && Number.isFinite(o.penalty) ? Math.max(0, Math.floor(o.penalty)) : 0;
  const deadlineDays =
    typeof o.deadlineDays === "number" && Number.isFinite(o.deadlineDays)
      ? Math.max(1, Math.min(365, Math.floor(o.deadlineDays)))
      : 7;

  const verify = parsePresetVerify(o.verify);

  return { key, label, points, penalty, deadlineDays, verify };
}

export function listTaskPresetsFromConfig(configJson: unknown): TaskPresetEntry[] {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const tp = root.taskPresets;
  if (!tp || typeof tp !== "object" || Array.isArray(tp)) return [];

  const out: TaskPresetEntry[] = [];
  for (const scope of SCOPES) {
    const arr = (tp as Record<string, unknown>)[scope];
    if (!Array.isArray(arr)) continue;
    arr.forEach((item, idx) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const p = parsePresetItem(item as Record<string, unknown>, scope, idx);
      if (p) out.push(p);
    });
  }
  return out;
}

export function findTaskPresetByKey(configJson: unknown, taskKey: string): TaskPresetEntry | null {
  const k = taskKey.trim();
  if (!k) return null;
  return listTaskPresetsFromConfig(configJson).find((x) => x.key === k) ?? null;
}
