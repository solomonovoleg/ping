/** Разбор gifts_json кампании (массив или { templates: [] }). */

export function giftTemplatesList(giftsJson: unknown): unknown[] {
  if (Array.isArray(giftsJson)) return giftsJson;
  if (giftsJson && typeof giftsJson === "object" && Array.isArray((giftsJson as { templates?: unknown[] }).templates)) {
    return (giftsJson as { templates: unknown[] }).templates;
  }
  return [];
}

export function resolveGiftLabel(giftsJson: unknown, giftKey: string): string {
  const templates = giftTemplatesList(giftsJson);
  for (const t of templates) {
    if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      const k = o.key ?? o.id ?? o.slug;
      if (String(k ?? "") === giftKey) {
        return String(o.title ?? o.name ?? o.label ?? giftKey);
      }
    }
  }
  if (templates.length === 1 && giftKey === "default") {
    const o = templates[0] as Record<string, unknown>;
    return String(o.title ?? o.name ?? o.label ?? "Приз");
  }
  return giftKey;
}

export type WinnerDmTemplate = {
  enabled: boolean;
  text: string;
  mediaUrl: string | null;
};

function readWinnerDm(o: Record<string, unknown>): WinnerDmTemplate | null {
  const raw = o.winnerDm;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const dm = raw as Record<string, unknown>;
  if (dm.enabled !== true) return null;
  const text = typeof dm.text === "string" ? dm.text.trim() : "";
  const mediaUrl =
    typeof dm.mediaUrl === "string" && dm.mediaUrl.trim() ? dm.mediaUrl.trim() : null;
  if (!text && !mediaUrl) return null;
  return { enabled: true, text, mediaUrl };
}

/** ЛС победителю: только если в шаблоне приза `winnerDm.enabled` и есть текст и/или медиа. */
export function winnerDmForGiftKey(giftsJson: unknown, giftKey: string): WinnerDmTemplate | null {
  const templates = giftTemplatesList(giftsJson);
  for (const t of templates) {
    if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      const k = o.key ?? o.id ?? o.slug;
      if (String(k ?? "") === giftKey) {
        return readWinnerDm(o);
      }
    }
  }
  if (templates.length === 1 && giftKey === "default") {
    const o = templates[0] as Record<string, unknown>;
    return readWinnerDm(o);
  }
  return null;
}

/** Лимит выдач по призу из шаблона; `null` — без лимита в конфиге. */
export function giftQuantityForKey(giftsJson: unknown, giftKey: string): number | null {
  const templates = giftTemplatesList(giftsJson);
  for (const t of templates) {
    if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      const k = o.key ?? o.id ?? o.slug;
      if (String(k ?? "") === giftKey) {
        const q = o.quantity;
        if (typeof q === "number" && q > 0) return Math.min(9999, Math.floor(q));
        return null;
      }
    }
  }
  if (templates.length === 1 && giftKey === "default") {
    const o = templates[0] as Record<string, unknown>;
    const q = o.quantity;
    if (typeof q === "number" && q > 0) return Math.min(9999, Math.floor(q));
    return null;
  }
  return null;
}

/** После розыгрыша приза: какие рейтинги заморозить в БД (`*_leaderboard_frozen_at`). */
export type GiftLeaderboardFreezeTargets = { freezePrimary: boolean; freezeSecondary: boolean };

export function giftLeaderboardFreezeTargetsForKey(giftsJson: unknown, giftKey: string): GiftLeaderboardFreezeTargets {
  const templates = giftTemplatesList(giftsJson);
  const resolveRow = (): Record<string, unknown> | null => {
    for (const t of templates) {
      if (t && typeof t === "object") {
        const o = t as Record<string, unknown>;
        const k = String(o.key ?? o.id ?? o.slug ?? "");
        if (k === giftKey) return o;
      }
    }
    if (templates.length === 1 && giftKey === "default") {
      const t = templates[0];
      if (t && typeof t === "object") return t as Record<string, unknown>;
    }
    return null;
  };
  const o = resolveRow();
  if (!o) {
    return { freezePrimary: true, freezeSecondary: true };
  }
  const raw = o.leaderboardScopes;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { freezePrimary: true, freezeSecondary: true };
  }
  const scopes = raw.filter((x): x is "primary" | "secondary" => x === "primary" || x === "secondary");
  if (scopes.length === 0) {
    return { freezePrimary: true, freezeSecondary: true };
  }
  return {
    freezePrimary: scopes.includes("primary"),
    freezeSecondary: scopes.includes("secondary"),
  };
}
