import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { getAuthorWall } from "../posts/author-wall";
import { getStoriesByAuthorId } from "../stories/service";
import { notifyFollow } from "../notifications/create";
import { NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH, postComments, postReactions, posts } from "@shared/schema";

export class UsersServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function normalizeProfileIdParam(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value).trim().replace(/^@+/, "");
  } catch {
    return value.trim().replace(/^@+/, "");
  }
}

/** undefined — не менять; null — сбросить */
function parseNicknameUpdate(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new UsersServiceError(400, "Никнейм указан неверно");
  const s = raw.trim().replace(/^@+/u, "").slice(0, NICKNAME_MAX_LENGTH);
  if (!s) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(s)) {
    throw new UsersServiceError(400, "Никнейм: только буквы, цифры, точка, подчёркивание и дефис");
  }
  return s;
}

function normalizeGenderValue(value: unknown): "male" | "female" | "other" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "мужской") return "male";
  if (normalized === "female" || normalized === "женский") return "female";
  if (normalized === "other" || normalized === "другое") return "other";
  return null;
}

function buildUnavailableProfile(target: {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: target.id,
    publicId: target.publicId,
    displayName: target.displayName ?? "Пользователь",
    surname: target.surname ?? null,
    gender: null,
    avatarUrl: target.avatarUrl ?? null,
    coverUrl: null,
    showCover: false,
    profileLink: null,
    hideFromSearch: true,
    bio: "Аккаунт недоступен",
    canMessage: false,
    isInMyContacts: false,
    isFollowing: false,
    isBlockedByMe: false,
    isMe: false,
    followersCount: 0,
    followingCount: 0,
    postsCount: 0,
    reactionsCount: 0,
    commentsCount: 0,
  };
}

async function resolveProfileTarget(idParam: string) {
  let target = await storage.getUser(idParam);
  if (!target && /^\d+$/.test(String(idParam))) {
    target = await storage.getUserByPublicId(parseInt(String(idParam), 10));
  }
  if (!target) throw new UsersServiceError(404, "Пользователь не найден");
  return target;
}

async function getProfileCounters(userId: string) {
  const db = getDb();
  const [postsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.authorId, userId));
  const [reactionsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postReactions)
    .where(eq(postReactions.userId, userId));
  const [commentsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postComments)
    .where(eq(postComments.userId, userId));
  return {
    postsCount: postsRow?.count ?? 0,
    reactionsCount: reactionsRow?.count ?? 0,
    commentsCount: commentsRow?.count ?? 0,
  };
}

async function buildProfileForViewer(viewerId: string, target: NonNullable<Awaited<ReturnType<typeof storage.getUser>>>) {
  if (target.deletedAt || target.isBlocked) {
    return buildUnavailableProfile(target);
  }
  const isMe = target.id === viewerId;
  let canMessage = true;
  let isInMyContacts = false;
  let isFollowing = false;
  let isBlockedByMe = false;
  let isBlockedMe = false;
  if (!isMe) {
    isInMyContacts = await storage.isContact(viewerId, target.id);
    isFollowing = await storage.isFollowing(viewerId, target.id);
    isBlockedByMe = await storage.isBlocked(viewerId, target.id);
    isBlockedMe = await storage.isBlocked(target.id, viewerId);
    if (target.hideFromSearch) canMessage = isInMyContacts;
    if (isBlockedByMe || isBlockedMe) canMessage = false;
  }
  const [followersCount, followingCount, counters] = await Promise.all([
    storage.getFollowersCount(target.id),
    storage.getFollowingCount(target.id),
    getProfileCounters(target.id),
  ]);
  return {
    id: target.id,
    publicId: target.publicId,
    displayName: target.displayName ?? null,
    surname: target.surname ?? null,
    nickname: target.nickname ?? null,
    gender: target.gender ?? null,
    avatarUrl: target.avatarUrl ?? null,
    coverUrl: target.coverUrl ?? null,
    showCover: (target as { showCover?: boolean }).showCover !== false,
    profileLink: target.profileLink ?? null,
    hideFromSearch: target.hideFromSearch ?? false,
    bio: target.bio ?? null,
    canMessage,
    isInMyContacts,
    isFollowing,
    isBlockedByMe,
    isMe,
    followersCount,
    followingCount,
    postsCount: counters.postsCount,
    reactionsCount: counters.reactionsCount,
    commentsCount: counters.commentsCount,
  };
}

export async function searchUsersForViewer(viewerId: string, q: string) {
  const users = await storage.searchUsers(q, viewerId);
  return users.map((u) => ({
    id: u.id,
    publicId: u.publicId,
    phone: u.phone,
    displayName: u.displayName ?? null,
    surname: u.surname ?? null,
    gender: u.gender ?? null,
    birthDate: u.birthDate ?? null,
    avatarUrl: u.avatarUrl ?? null,
  }));
}

export async function savePushToken(userId: string, token: string | null): Promise<void> {
  await storage.updateUserFcmToken(userId, token || null);
}

export async function updateMyProfile(userId: string, body: Record<string, unknown>) {
  const current = await storage.getUser(userId);
  if (!current) throw new UsersServiceError(404, "User not found");

  const {
    displayName,
    surname,
    nickname,
    gender,
    birthDate,
    avatarUrl,
    hideFromSearch,
    bio,
    coverUrl,
    showCover,
    profileLink,
    city,
    status,
    pinnedPostId,
    profileVisibility,
    showOnlineTo,
    pushEnabled,
    vibeEnabled,
    vibeShareWithPartner,
  } = body ?? {};
  let name = typeof displayName === "string" ? displayName.trim() : (current.displayName ?? "");
  let fam = typeof surname === "string" ? surname.trim() : (current.surname ?? "");
  name = name.slice(0, NAME_MAX_LENGTH);
  fam = fam.slice(0, NAME_MAX_LENGTH);
  if (!name || !fam) throw new UsersServiceError(400, "Имя и фамилия обязательны");

  const incomingGender = normalizeGenderValue(gender);
  const currentGender = normalizeGenderValue(current.gender);
  const genderVal = incomingGender ?? currentGender;
  if (!genderVal) throw new UsersServiceError(400, "Укажите пол (мужской, женский или другое)");

  const birthDateVal = birthDate !== undefined
    ? (typeof birthDate === "string" ? (birthDate.trim() || null) : null)
    : undefined;

  const nicknameVal = parseNicknameUpdate(nickname);

  const user = await storage.updateUserProfile(userId, {
    displayName: name || null,
    surname: fam || null,
    gender: genderVal,
    ...(birthDateVal !== undefined && { birthDate: birthDateVal }),
    ...(typeof avatarUrl === "string" && { avatarUrl: avatarUrl.trim() || null }),
    ...(typeof hideFromSearch === "boolean" && { hideFromSearch }),
    ...(bio !== undefined && { bio: bio === null || bio === "" ? null : (typeof bio === "string" ? bio.trim() || null : null) }),
    ...(coverUrl !== undefined && { coverUrl: coverUrl === null || coverUrl === "" ? null : (typeof coverUrl === "string" ? coverUrl.trim() || null : null) }),
    ...(typeof showCover === "boolean" && { showCover }),
    ...(profileLink !== undefined && { profileLink: profileLink === null || profileLink === "" ? null : (typeof profileLink === "string" ? profileLink.trim() || null : null) }),
    ...(city !== undefined && { city: city === null || city === "" ? null : (typeof city === "string" ? city.trim() || null : null) }),
    ...(status !== undefined && { status: status === null || status === "" ? null : (typeof status === "string" ? status.trim() || null : null) }),
    ...(pinnedPostId !== undefined && { pinnedPostId: pinnedPostId === null || pinnedPostId === "" ? null : (typeof pinnedPostId === "string" ? pinnedPostId.trim() || null : null) }),
    ...(profileVisibility === "all" || profileVisibility === "followers" ? { profileVisibility } : {}),
    ...(showOnlineTo === "all" || showOnlineTo === "followers" ? { showOnlineTo } : {}),
    ...(typeof pushEnabled === "boolean" && { pushEnabled }),
    ...(typeof vibeEnabled === "boolean" && { vibeEnabled }),
    ...(typeof vibeShareWithPartner === "boolean" && { vibeShareWithPartner }),
    ...(nicknameVal !== undefined && { nickname: nicknameVal }),
  });
  if (!user) throw new UsersServiceError(404, "User not found");

  return {
    id: user.id,
    publicId: user.publicId,
    phone: user.phone,
    displayName: user.displayName ?? null,
    surname: user.surname ?? null,
    nickname: user.nickname ?? null,
    gender: normalizeGenderValue(user.gender) ?? null,
    birthDate: user.birthDate ?? null,
    avatarUrl: user.avatarUrl ?? null,
    hideFromSearch: user.hideFromSearch ?? false,
    bio: user.bio ?? null,
    coverUrl: user.coverUrl ?? null,
    showCover: (user as { showCover?: boolean }).showCover !== false,
    profileLink: user.profileLink ?? null,
    city: (user as { city?: string | null }).city ?? null,
    status: (user as { status?: string | null }).status ?? null,
    pinnedPostId: (user as { pinnedPostId?: string | null }).pinnedPostId ?? null,
    profileVisibility: (user as { profileVisibility?: string }).profileVisibility ?? "all",
    showOnlineTo: (user as { showOnlineTo?: string }).showOnlineTo ?? "all",
    pushEnabled: (user as { pushEnabled?: boolean }).pushEnabled !== false,
    vibeEnabled: (user as { vibeEnabled?: boolean }).vibeEnabled === true,
    vibeShareWithPartner: (user as { vibeShareWithPartner?: boolean }).vibeShareWithPartner === true,
  };
}

export async function getProfilePage(viewerId: string, idParam: string, postsLimit: number) {
  const target = await resolveProfileTarget(idParam);
  if (target.deletedAt || target.isBlocked) {
    return { profile: buildUnavailableProfile(target), posts: [], stories: [] };
  }
  const [profile, profilePosts, profileStories] = await Promise.all([
    buildProfileForViewer(viewerId, target),
    getAuthorWall(viewerId, target.id, postsLimit),
    getStoriesByAuthorId(target.id, viewerId),
  ]);
  return { profile, posts: profilePosts, stories: profileStories };
}

export async function getProfileOnly(viewerId: string, idParam: string) {
  const target = await resolveProfileTarget(idParam);
  return buildProfileForViewer(viewerId, target);
}

export async function followUser(viewerId: string, targetUserId: string): Promise<void> {
  if (!targetUserId || targetUserId === viewerId) {
    throw new UsersServiceError(400, "Нельзя подписаться на себя");
  }
  const target = await storage.getUser(targetUserId);
  if (!target || target.deletedAt || target.isBlocked) {
    throw new UsersServiceError(404, "Пользователь не найден");
  }
  await storage.addFollow(viewerId, targetUserId);
  await storage.addContact(viewerId, targetUserId);
  notifyFollow(targetUserId, viewerId).catch((e) => console.error("[users] notify follow:", e));
}

export async function unfollowUser(viewerId: string, targetUserId: string): Promise<void> {
  if (!targetUserId) throw new UsersServiceError(400, "userId не указан");
  await storage.removeFollow(viewerId, targetUserId);
}

export async function getFollowersList(targetUserId: string, limit: number, offset: number) {
  return storage.getFollowersList(targetUserId, limit, offset);
}

export async function getFollowingList(targetUserId: string, limit: number, offset: number) {
  return storage.getFollowingList(targetUserId, limit, offset);
}

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!blockedId || blockedId === blockerId) {
    throw new UsersServiceError(400, "Нельзя заблокировать себя");
  }
  const target = await storage.getUser(blockedId);
  if (!target || target.deletedAt) {
    throw new UsersServiceError(404, "Пользователь не найден");
  }
  await storage.addBlock(blockerId, blockedId);
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  if (!blockedId) throw new UsersServiceError(400, "userId не указан");
  await storage.removeBlock(blockerId, blockedId);
}

export async function addContact(userId: string, contactUserId: string): Promise<void> {
  if (typeof contactUserId !== "string" || !contactUserId) {
    throw new UsersServiceError(400, "Укажите contactUserId");
  }
  if (contactUserId === userId) {
    throw new UsersServiceError(400, "Нельзя добавить себя");
  }
  const other = await storage.getUser(contactUserId);
  if (!other || other.deletedAt || other.isBlocked) {
    throw new UsersServiceError(404, "Пользователь не найден");
  }
  await storage.addContact(userId, contactUserId);
}

export async function listContacts(userId: string, includeProfiles: boolean) {
  const ids = await storage.listContactUserIds(userId);
  if (includeProfiles && ids.length > 0) {
    const contacts = await Promise.all(ids.map((id) => storage.getUser(id)));
    return contacts
      .filter((u): u is NonNullable<typeof u> => !!u && !u.deletedAt && !u.isBlocked)
      .map((u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        avatarUrl: u.avatarUrl ?? null,
      }));
  }
  return ids;
}
