type MeForRoute = { publicId: number; nickname?: string | null } | null | undefined;

export function normalizeProfileRouteId(rawId: string): string {
  return rawId.trim().replace(/^@+/, "");
}

/**
 * "Own profile" means only /u/me, /u/<my publicId> or /u/<my nickname>.
 */
export function isOwnProfileRoute(args: {
  routeIdRaw: string;
  normalizedRouteId: string;
  me: MeForRoute;
  authResolved: boolean;
}): boolean {
  const trimmed = args.routeIdRaw.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase() === "me") return true;
  if (!args.authResolved || !args.me) return false;
  if (/^\d+$/u.test(args.normalizedRouteId) && args.normalizedRouteId === String(args.me.publicId)) return true;
  const nick = (args.me.nickname ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (nick && args.normalizedRouteId.toLowerCase() === nick) return true;
  return false;
}

export function isInvalidProfileRouteId(normalizedRouteId: string): boolean {
  if (!normalizedRouteId) return true;
  return ["undefined", "null", "nan"].includes(normalizedRouteId.toLowerCase());
}
