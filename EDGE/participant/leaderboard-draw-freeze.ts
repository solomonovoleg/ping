import type { EdgeCampaignRow } from "../companion/repo.js";
import type { EdgeGiftTemplate, EdgeLeaderboardScope } from "../campaign/types.js";

/** Шаблоны призов из `gifts_json`. */
export function parseGiftTemplates(giftsJson: unknown): EdgeGiftTemplate[] {
  if (!giftsJson || typeof giftsJson !== "object" || Array.isArray(giftsJson)) return [];
  const raw = (giftsJson as { templates?: unknown }).templates;
  if (!Array.isArray(raw)) return [];
  const out: EdgeGiftTemplate[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue;
    const key = typeof o.key === "string" && o.key.trim() ? o.key.trim() : `gift_${out.length + 1}`;
    const g: EdgeGiftTemplate = { key, title };
    if (typeof o.description === "string" && o.description.trim()) g.description = o.description.trim();
    if (typeof o.quantity === "number" && o.quantity > 0) g.quantity = Math.min(9999, Math.floor(o.quantity));
    if (typeof o.imageUrl === "string" && o.imageUrl.trim()) g.imageUrl = o.imageUrl.trim();
    if (typeof o.videoUrl === "string" && o.videoUrl.trim()) g.videoUrl = o.videoUrl.trim();
    if (typeof o.selectionRule === "string" && o.selectionRule.trim()) g.selectionRule = o.selectionRule.trim();
    if (o.drawAt === null) {
      g.drawAt = null;
    } else if (typeof o.drawAt === "string" && o.drawAt.trim()) {
      const ts = Date.parse(o.drawAt);
      if (Number.isFinite(ts)) g.drawAt = new Date(ts).toISOString();
    }
    if (Array.isArray(o.leaderboardScopes)) {
      const uniq = new Set<EdgeLeaderboardScope>();
      for (const s of o.leaderboardScopes) {
        if (s === "primary" || s === "secondary") uniq.add(s);
      }
      g.leaderboardScopes = Array.from(uniq);
    }
    out.push(g);
  }
  return out;
}

function giftPassedDrawFreezesKind(g: EdgeGiftTemplate, kind: EdgeLeaderboardScope, nowMs: number): boolean {
  if (g.drawAt == null || typeof g.drawAt !== "string" || !g.drawAt.trim()) return false;
  const ts = Date.parse(g.drawAt);
  if (!Number.isFinite(ts) || ts > nowMs) return false;
  const scopes = g.leaderboardScopes;
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return true;
  }
  return scopes.includes(kind);
}

/** Есть приз с наступившей датой розыгрыша, привязанный к этому рейтингу (или без scope — к обоим). */
export function isPassedPrizeDrawFreezingKind(
  templates: EdgeGiftTemplate[],
  kind: EdgeLeaderboardScope,
  now: Date,
): boolean {
  const nowMs = now.getTime();
  return templates.some((g) => giftPassedDrawFreezesKind(g, kind, nowMs));
}

function readPrizeDrawRankingFreezeLifted(configJson: unknown, kind: EdgeLeaderboardScope): boolean {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const lbs =
    root.leaderboards && typeof root.leaderboards === "object" && !Array.isArray(root.leaderboards)
      ? (root.leaderboards as Record<string, unknown>)
      : {};
  const branchKey = kind === "primary" ? "primary" : "secondary";
  const branch =
    lbs[branchKey] && typeof lbs[branchKey] === "object" && !Array.isArray(lbs[branchKey])
      ? (lbs[branchKey] as Record<string, unknown>)
      : {};
  return branch.prizeDrawRankingFreezeLifted === true;
}

/**
 * Начисление в рейтинг заблокировано: явная заморозка в БД или наступила дата розыгрыша приза
 * (если создатель не снял паузу через `prizeDrawRankingFreezeLifted` в config_json).
 */
export function effectiveLeaderboardXpFrozen(row: EdgeCampaignRow, kind: EdgeLeaderboardScope, now: Date): boolean {
  const manual = kind === "secondary" ? row.secondary_leaderboard_frozen_at : row.primary_leaderboard_frozen_at;
  if (manual instanceof Date) return true;
  if (readPrizeDrawRankingFreezeLifted(row.config_json, kind)) return false;
  return isPassedPrizeDrawFreezingKind(parseGiftTemplates(row.gifts_json), kind, now);
}

/**
 * Отпечаток расписания розыгрышей для рейтинга: только шаблоны, которые этот рейтинг затрагивают
 * (`leaderboardScopes` пустой = оба рейтинга).
 */
export function prizeDrawScheduleFingerprintForKind(
  templates: EdgeGiftTemplate[],
  kind: EdgeLeaderboardScope,
): string {
  const parts: string[] = [];
  for (const g of templates) {
    const scopes = g.leaderboardScopes;
    if (Array.isArray(scopes) && scopes.length > 0 && !scopes.includes(kind)) continue;
    const d = g.drawAt == null ? "" : String(g.drawAt);
    const sc = (scopes ?? []).slice().sort().join(",");
    parts.push(`${g.key}\t${d}\t${sc}`);
  }
  parts.sort();
  return parts.join("\n");
}

function asCfgObj(x: unknown): Record<string, unknown> {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : {};
}

/**
 * После смены списка призов сбрасываем `prizeDrawRankingFreezeLifted` только для того рейтинга,
 * у которого изменилось расписание (даты/scopes по затрагивающим его призам).
 * Если в том же PATCH явно поднят lift — не трогаем этот флаг.
 */
export function clearPrizeDrawLiftIfGiftScheduleChanged(
  mergedConfig: Record<string, unknown>,
  oldGiftsJson: unknown,
  newGiftsJson: unknown,
  opts: { preservePrimaryLift?: boolean; preserveSecondaryLift?: boolean },
): Record<string, unknown> {
  const oldT = parseGiftTemplates(oldGiftsJson);
  const newT = parseGiftTemplates(newGiftsJson);
  const base = { ...mergedConfig };
  const lbs = { ...asCfgObj(base.leaderboards) };

  if (
    !opts.preservePrimaryLift &&
    prizeDrawScheduleFingerprintForKind(oldT, "primary") !== prizeDrawScheduleFingerprintForKind(newT, "primary")
  ) {
    const prim = { ...asCfgObj(lbs.primary) };
    delete prim.prizeDrawRankingFreezeLifted;
    lbs.primary = prim;
  }
  if (
    !opts.preserveSecondaryLift &&
    prizeDrawScheduleFingerprintForKind(oldT, "secondary") !== prizeDrawScheduleFingerprintForKind(newT, "secondary")
  ) {
    const sec = { ...asCfgObj(lbs.secondary) };
    delete sec.prizeDrawRankingFreezeLifted;
    lbs.secondary = sec;
  }

  base.leaderboards = lbs;
  return base;
}
