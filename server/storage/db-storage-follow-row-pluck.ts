export function pluckContactUserIds(rows: { contactUserId: string }[]): string[] {
  return rows.map((r) => r.contactUserId);
}

export function pluckFollowingIds(rows: { followingId: string }[]): string[] {
  return rows.map((r) => r.followingId);
}

export function pluckFollowerIds(rows: { followerId: string }[]): string[] {
  return rows.map((r) => r.followerId);
}
