/** Нормализованный `posts.edge_id` для кампании EDGE. */
export function parsePostEdgeId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 128) return null;
  if (!/^[a-zA-Z0-9_.:-]+$/.test(t)) return null;
  return t;
}
