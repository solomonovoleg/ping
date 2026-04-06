export function giftTitle(t: unknown): string {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "Приз";
  const o = t as Record<string, unknown>;
  if (typeof o.title === "string" && o.title.trim()) return o.title.trim();
  if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  if (typeof o.label === "string" && o.label.trim()) return o.label.trim();
  return "Приз";
}

export function giftDescription(t: unknown): string {
  if (!t || typeof t !== "object" || Array.isArray(t)) return "";
  const o = t as Record<string, unknown>;
  if (typeof o.description === "string" && o.description.trim()) return o.description.trim();
  if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
  return "";
}

export function giftGlowRgb(i: number): string {
  const palette = ["245,158,11", "16,185,129", "139,92,246", "59,130,246"];
  return palette[i % palette.length]!;
}
