export type PulseProfileMetaLineParts = {
  idChip?: string | null;
  businessChip?: string | null;
  genderChip?: string | null;
  birthChip?: string | null;
  cityChip?: string | null;
};

/** Одна строка под именем в герой-карточке («ID · пол · 🎂 · город»). */
export function buildPulseProfileMetaLine(parts: PulseProfileMetaLineParts): string {
  const metaParts: string[] = [];
  if (parts.idChip) metaParts.push(parts.idChip);
  if (parts.businessChip) metaParts.push(parts.businessChip);
  if (parts.genderChip) metaParts.push(parts.genderChip);
  if (parts.birthChip) metaParts.push(`🎂 ${parts.birthChip}`);
  if (parts.cityChip) metaParts.push(parts.cityChip);
  return metaParts.join(" · ");
}
