export function clampReferralCodeMaxUses(raw: number | undefined): number {
  let maxUses = raw ?? 1;
  if (maxUses === 0 || maxUses < -1) maxUses = 1;
  if (maxUses > 10_000) maxUses = 10_000;
  return maxUses;
}

export function normalizeReferralAdminNote(adminNote: string | undefined): string | null {
  const t = adminNote?.trim();
  return t ? t : null;
}
