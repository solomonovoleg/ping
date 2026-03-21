export function formatGenderChip(g: string | null | undefined): string | null {
  if (!g) return null;
  const x = g.toLowerCase();
  if (x === "male" || x === "мужской") return "♂ Мужской";
  if (x === "female" || x === "женский") return "♀ Женский";
  if (x === "other" || x === "другое") return "Другое";
  return null;
}

export function formatBirthChip(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"] as const;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
