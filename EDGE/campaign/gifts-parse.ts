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
