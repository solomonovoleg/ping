import { storage } from "../storage";

export type SocialPolicy = "all" | "followers" | "mutual";

export function normalizeSocialPolicy(raw: unknown): SocialPolicy {
  const s = String(raw ?? "all").toLowerCase();
  if (s === "followers" || s === "mutual") return s;
  return "all";
}

/** Политика получателя ЛС: может ли viewer написать first (уже с учётом блоков снаружи). */
export function computeDmAllowedForViewer(opts: {
  policy: SocialPolicy;
  viewerFollowsTarget: boolean;
  targetFollowsViewer: boolean;
}): boolean {
  const { policy, viewerFollowsTarget, targetFollowsViewer } = opts;
  if (policy === "all") return true;
  if (policy === "followers") return viewerFollowsTarget;
  if (policy === "mutual") return viewerFollowsTarget && targetFollowsViewer;
  return true;
}

export function computeGroupAddAllowed(opts: {
  policy: SocialPolicy;
  targetFollowsActor: boolean;
  actorFollowsTarget: boolean;
}): boolean {
  const { policy, targetFollowsActor, actorFollowsTarget } = opts;
  if (policy === "all") return true;
  if (policy === "followers") return targetFollowsActor;
  if (policy === "mutual") return targetFollowsActor && actorFollowsTarget;
  return true;
}

/** viewerId пишет targetUserId: политика на стороне получателя. */
export async function viewerMayDmTarget(viewerId: string, targetUserId: string): Promise<boolean> {
  const target = await storage.getUser(targetUserId);
  if (!target || target.deletedAt || target.isBlocked) return false;
  const policy = normalizeSocialPolicy((target as { dmPolicy?: string }).dmPolicy);
  const viewerFollowsTarget = await storage.isFollowing(viewerId, targetUserId);
  const targetFollowsViewer = await storage.isFollowing(targetUserId, viewerId);
  return computeDmAllowedForViewer({ policy, viewerFollowsTarget, targetFollowsViewer });
}

/** actorUserId добавляет targetUserId в группу — проверяем политику у добавляемого. */
export async function targetAllowsGroupAddFromActor(actorUserId: string, targetUserId: string): Promise<boolean> {
  const target = await storage.getUser(targetUserId);
  if (!target || target.deletedAt || target.isBlocked) return false;
  const policy = normalizeSocialPolicy((target as { groupAddMePolicy?: string }).groupAddMePolicy);
  const targetFollowsActor = await storage.isFollowing(targetUserId, actorUserId);
  const actorFollowsTarget = await storage.isFollowing(actorUserId, targetUserId);
  return computeGroupAddAllowed({ policy, targetFollowsActor, actorFollowsTarget });
}
