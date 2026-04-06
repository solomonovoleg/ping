import { and, eq, sql } from "drizzle-orm";
import { computeDmAllowedForViewer, normalizeSocialPolicy } from "./social-policy";
import { normalizePhone } from "../auth/phone";
import { getDb } from "../db";
import { storage } from "../storage";
import { getAuthorWall } from "../posts/author-wall";
import { getStoriesByAuthorId } from "../stories/service";
import { recordProfilePageView } from "./profile-analytics";
import { resolveMediaUrlForClient } from "../upload/s3-presign-media-urls";
import { notifyFollow } from "../notifications/create";
import {
  NAME_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PROFILE_CITY_MAX_LENGTH,
  postComments,
  postReactions,
  posts,
  users,
} from "@shared/schema";

const BUSINESS_CONTACT_PHONE_MAX_LENGTH = 64;
const BUSINESS_ADDRESS_MAX_LENGTH = 300;

export class UsersServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeBusinessStatusValue(value: unknown): "none" | "pending" | "approved" | "rejected" | "revision_required" {
  if (
    value === "none" ||
    value === "pending" ||
    value === "approved" ||
    value === "rejected" ||
    value === "revision_required"
  ) {
    return value;
  }
  return "none";
}

function sanitizeBusinessContactPhone(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new UsersServiceError(400, "Телефон бизнеса указан неверно");
  const value = raw.trim();
  if (!value) return null;
  if (!/^[+()\-\d\s]{5,64}$/u.test(value)) {
    throw new UsersServiceError(400, "Телефон бизнеса: допустимы цифры, пробел, +, скобки и дефис");
  }
  return value.slice(0, BUSINESS_CONTACT_PHONE_MAX_LENGTH);
}

function sanitizeBusinessAddress(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") throw new UsersServiceError(400, "Адрес бизнеса указан неверно");
  const value = raw.trim();
  if (!value) return null;
  return value.slice(0, BUSINESS_ADDRESS_MAX_LENGTH);
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

/** Нормализация пола для API и БД (en + ru). Экспорт для ответов /auth/me и единообразия с PATCH профиля. */
export function normalizeGenderValue(value: unknown): "male" | "female" | "other" | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.trunc(value);
    if (n === 1) return "male";
    if (n === 2) return "female";
    if (n === 3) return "other";
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "мужской" || normalized === "m" || normalized === "man" || normalized === "м") {
    return "male";
  }
  if (
    normalized === "female" ||
    normalized === "женский" ||
    normalized === "f" ||
    normalized === "woman" ||
    normalized === "w" ||
    normalized === "ж"
  ) {
    return "female";
  }
  if (normalized === "other" || normalized === "другое" || normalized === "o" || normalized === "x") return "other";
  return null;
}

async function buildUnavailableProfile(target: {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
}) {
  const avatarUrl = await resolveMediaUrlForClient(target.avatarUrl ?? null);
  return {
    id: target.id,
    publicId: target.publicId,
    displayName: target.displayName ?? "Пользователь",
    surname: target.surname ?? null,
    gender: null,
    avatarUrl,
    coverUrl: null,
    showCover: false,
    profileLink: null,
    city: null,
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
    isFollowedByTarget: false,
    isMutualFollow: false,
    pinnedPostId: null,
    businessStatus: "none",
    businessContactPhone: null,
    businessAddress: null,
  };
}

export async function resolveProfileTarget(idParam: string) {
  let target = await storage.getUser(idParam);
  if (!target && /^\d+$/.test(String(idParam))) {
    target = await storage.getUserByPublicId(parseInt(String(idParam), 10));
  }
  if (!target) {
    const normalizedNickname = String(idParam).trim().replace(/^@+/, "");
    if (normalizedNickname) {
      const db = getDb();
      const [byNickname] = await db
        .select()
        .from(users)
        .where(sql`LOWER(${users.nickname}) = LOWER(${normalizedNickname})`)
        .limit(1);
      if (byNickname) target = byNickname;
    }
  }
  if (!target) throw new UsersServiceError(404, "Пользователь не найден");
  return target;
}

async function getProfileCounters(userId: string) {
  const db = getDb();
  const [postsRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(eq(posts.authorId, userId), eq(posts.showOnAuthorWall, true)));
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
    return await buildUnavailableProfile(target);
  }
  const isMe = target.id === viewerId;
  let canMessage = true;
  let isInMyContacts = false;
  let isFollowing = false;
  let isFollowedByTarget = false;
  let isBlockedByMe = false;
  let isBlockedMe = false;
  let theirBlockOfViewer: Awaited<ReturnType<typeof storage.getBlockFlags>> = null;
  if (!isMe) {
    isInMyContacts = await storage.isContact(viewerId, target.id);
    isFollowing = await storage.isFollowing(viewerId, target.id);
    isFollowedByTarget = await storage.isFollowing(target.id, viewerId);
    isBlockedByMe = await storage.isBlocked(viewerId, target.id);
    isBlockedMe = await storage.isBlocked(target.id, viewerId);
    if (target.hideFromSearch) canMessage = isInMyContacts;
    theirBlockOfViewer = await storage.getBlockFlags(target.id, viewerId);
    if (theirBlockOfViewer?.restrictChat) canMessage = false;
  }
  const loadMutual =
    !isMe && !isBlockedByMe && !isBlockedMe
      ? Promise.all([
          storage.countMutualFollowingWhoFollowTarget(viewerId, target.id),
          storage.listMutualFollowingWhoFollowTarget(viewerId, target.id, 3),
        ])
      : Promise.resolve([0, []] as const);

  const [followersCount, followingCount, counters, mutualPair] = await Promise.all([
    storage.getFollowersCount(target.id),
    storage.getFollowingCount(target.id),
    getProfileCounters(target.id),
    loadMutual,
  ]);

  const [mutualCount, mutualPreview] = mutualPair;
  const mutualFollowers =
    !isMe && !isBlockedByMe && !isBlockedMe && mutualCount > 0
      ? {
          count: mutualCount,
          preview: await Promise.all(
            mutualPreview.map(async (u) => ({
              ...u,
              avatarUrl: await resolveMediaUrlForClient(u.avatarUrl),
            })),
          ),
        }
      : undefined;

  const [avatarUrl, coverUrl] = await Promise.all([
    resolveMediaUrlForClient(target.avatarUrl ?? null),
    resolveMediaUrlForClient(target.coverUrl ?? null),
  ]);
  const targetBusinessStatus = normalizeBusinessStatusValue((target as { businessStatus?: string | null }).businessStatus);
  const canShowBusinessContacts = targetBusinessStatus === "approved";

  return {
    id: target.id,
    publicId: target.publicId,
    displayName: target.displayName ?? null,
    surname: target.surname ?? null,
    nickname: target.nickname ?? null,
    gender: normalizeGenderValue(target.gender) ?? null,
    avatarUrl,
    coverUrl,
    showCover: (target as { showCover?: boolean }).showCover !== false,
    profileLink: target.profileLink ?? null,
    city: (target as { city?: string | null }).city ?? null,
    hideFromSearch: target.hideFromSearch ?? false,
    bio: target.bio ?? null,
    canMessage,
    isInMyContacts,
    isFollowing,
    isFollowedByTarget: !isMe ? isFollowedByTarget : false,
    isMutualFollow: !isMe && isFollowing && isFollowedByTarget,
    isBlockedByMe,
    isMe,
    followersCount,
    followingCount,
    postsCount: counters.postsCount,
    reactionsCount: counters.reactionsCount,
    commentsCount: counters.commentsCount,
    mutualFollowers,
    pinnedPostId: (target as { pinnedPostId?: string | null }).pinnedPostId ?? null,
    blockedByProfileOwner:
      !isMe && theirBlockOfViewer
        ? {
            restrictChat: theirBlockOfViewer.restrictChat,
            restrictProfile: theirBlockOfViewer.restrictProfile,
            restrictSocial: theirBlockOfViewer.restrictSocial,
            note: theirBlockOfViewer.blockNote,
          }
        : null,
    businessStatus: targetBusinessStatus,
    businessContactPhone: canShowBusinessContacts
      ? ((target as { businessContactPhone?: string | null }).businessContactPhone ?? null)
      : null,
    businessAddress: canShowBusinessContacts
      ? ((target as { businessAddress?: string | null }).businessAddress ?? null)
      : null,
  };
}

export async function searchUsersForViewer(
  viewerId: string,
  q: string,
  opts?: { businessOnly?: boolean },
) {
  const users = await storage.searchUsers(q, viewerId);
  const filtered = opts?.businessOnly
    ? users.filter(
        (u) =>
          normalizeBusinessStatusValue((u as { businessStatus?: string | null }).businessStatus) === "approved",
      )
    : users;
  return Promise.all(
    filtered.map(async (u) => ({
      id: u.id,
      publicId: u.publicId,
      displayName: u.displayName ?? null,
      surname: u.surname ?? null,
      nickname: u.nickname ?? null,
      gender: u.gender ?? null,
      birthDate: u.birthDate ?? null,
      avatarUrl: await resolveMediaUrlForClient(u.avatarUrl ?? null),
      businessStatus: normalizeBusinessStatusValue((u as { businessStatus?: string | null }).businessStatus),
    })),
  );
}

export async function savePushToken(userId: string, token: string | null): Promise<void> {
  await storage.updateUserFcmToken(userId, token || null);
}

export async function saveIosVoipToken(userId: string, token: string | null): Promise<void> {
  await storage.updateUserIosVoipToken(userId, token || null);
}

/** Поля профиля (имя, обложка и т.д.): при их изменении требуем непустые имя, фамилию и пол. */
const PROFILE_PATCH_IDENTITY_KEYS: readonly string[] = [
  "displayName",
  "surname",
  "gender",
  "birthDate",
  "nickname",
  "bio",
  "avatarUrl",
  "coverUrl",
  "showCover",
  "profileLink",
  "city",
  "status",
  "profileVisibility",
  "showOnlineTo",
];

function profilePatchTouchesPublicFields(body: Record<string, unknown>): boolean {
  return PROFILE_PATCH_IDENTITY_KEYS.some((k) => Object.prototype.hasOwnProperty.call(body, k));
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
    dmPolicy: dmPolicyRaw,
    groupAddMePolicy: groupAddMePolicyRaw,
    businessContactPhone,
    businessAddress,
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

  let dmPolicy: string | undefined;
  if (dmPolicyRaw !== undefined) {
    if (dmPolicyRaw !== "all" && dmPolicyRaw !== "followers" && dmPolicyRaw !== "mutual") {
      throw new UsersServiceError(400, "dmPolicy: допустимо all, followers или mutual");
    }
    dmPolicy = dmPolicyRaw;
  }
  let groupAddMePolicy: string | undefined;
  if (groupAddMePolicyRaw !== undefined) {
    if (groupAddMePolicyRaw !== "all" && groupAddMePolicyRaw !== "followers" && groupAddMePolicyRaw !== "mutual") {
      throw new UsersServiceError(400, "groupAddMePolicy: допустимо all, followers или mutual");
    }
    groupAddMePolicy = groupAddMePolicyRaw;
  }

  const touchesProfile = profilePatchTouchesPublicFields(body ?? {});
  const businessStatus = normalizeBusinessStatusValue((current as { businessStatus?: string | null }).businessStatus);
  const businessContactPhonePatch = sanitizeBusinessContactPhone(businessContactPhone);
  const businessAddressPatch = sanitizeBusinessAddress(businessAddress);
  if (
    (businessContactPhonePatch !== undefined || businessAddressPatch !== undefined) &&
    businessStatus !== "approved"
  ) {
    throw new UsersServiceError(403, "Контакты бизнеса доступны только для одобренного бизнес-профиля");
  }
  let pinnedPostIdPatch: string | null | undefined;
  if (pinnedPostId !== undefined) {
    if (pinnedPostId === null || pinnedPostId === "") {
      pinnedPostIdPatch = null;
    } else {
      const candidate = typeof pinnedPostId === "string" ? pinnedPostId.trim() : "";
      if (!candidate) throw new UsersServiceError(400, "Пост не указан");
      const db = getDb();
      const [p] = await db
        .select({
          id: posts.id,
          authorId: posts.authorId,
          isDraft: posts.isDraft,
          showOnAuthorWall: posts.showOnAuthorWall,
        })
        .from(posts)
        .where(eq(posts.id, candidate))
        .limit(1);
      if (!p) throw new UsersServiceError(404, "Пост не найден");
      if (p.authorId !== userId) throw new UsersServiceError(403, "Можно закрепить только свой пост");
      if (p.isDraft) throw new UsersServiceError(400, "Черновик нельзя закрепить");
      if (p.showOnAuthorWall === false) {
        throw new UsersServiceError(400, "Пост только для Push нельзя закрепить на профиле");
      }
      pinnedPostIdPatch = candidate;
    }
  }

  const user = await storage.updateUserProfile(userId, {
    ...(touchesProfile
      ? {
          displayName: name || null,
          surname: fam || null,
          gender: genderVal,
        }
      : {}),
    ...(birthDateVal !== undefined && { birthDate: birthDateVal }),
    ...(typeof avatarUrl === "string" && { avatarUrl: avatarUrl.trim() || null }),
    ...(typeof hideFromSearch === "boolean" && { hideFromSearch }),
    ...(bio !== undefined && { bio: bio === null || bio === "" ? null : (typeof bio === "string" ? bio.trim() || null : null) }),
    ...(coverUrl !== undefined && { coverUrl: coverUrl === null || coverUrl === "" ? null : (typeof coverUrl === "string" ? coverUrl.trim() || null : null) }),
    ...(typeof showCover === "boolean" && { showCover }),
    ...(profileLink !== undefined && { profileLink: profileLink === null || profileLink === "" ? null : (typeof profileLink === "string" ? profileLink.trim() || null : null) }),
    ...(city !== undefined && {
      city:
        city === null || city === ""
          ? null
          : typeof city === "string"
            ? city.trim().slice(0, PROFILE_CITY_MAX_LENGTH) || null
            : null,
    }),
    ...(status !== undefined && { status: status === null || status === "" ? null : (typeof status === "string" ? status.trim() || null : null) }),
    ...(pinnedPostIdPatch !== undefined && { pinnedPostId: pinnedPostIdPatch }),
    ...(profileVisibility === "all" || profileVisibility === "followers" ? { profileVisibility } : {}),
    ...(showOnlineTo === "all" || showOnlineTo === "followers" ? { showOnlineTo } : {}),
    ...(typeof pushEnabled === "boolean" && { pushEnabled }),
    ...(typeof vibeEnabled === "boolean" && { vibeEnabled }),
    ...(typeof vibeShareWithPartner === "boolean" && { vibeShareWithPartner }),
    ...(nicknameVal !== undefined && { nickname: nicknameVal }),
    ...(dmPolicy !== undefined && { dmPolicy }),
    ...(groupAddMePolicy !== undefined && { groupAddMePolicy }),
    ...(businessContactPhonePatch !== undefined && { businessContactPhone: businessContactPhonePatch }),
    ...(businessAddressPatch !== undefined && { businessAddress: businessAddressPatch }),
  });
  if (!user) throw new UsersServiceError(404, "User not found");

  const [patchedAvatarUrl, patchedCoverUrl] = await Promise.all([
    resolveMediaUrlForClient(user.avatarUrl ?? null),
    resolveMediaUrlForClient(user.coverUrl ?? null),
  ]);

  return {
    id: user.id,
    publicId: user.publicId,
    phone: user.phone,
    displayName: user.displayName ?? null,
    surname: user.surname ?? null,
    nickname: user.nickname ?? null,
    gender: normalizeGenderValue(user.gender) ?? null,
    birthDate: user.birthDate ?? null,
    avatarUrl: patchedAvatarUrl,
    hideFromSearch: user.hideFromSearch ?? false,
    bio: user.bio ?? null,
    coverUrl: patchedCoverUrl,
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
    dmPolicy: normalizeSocialPolicy((user as { dmPolicy?: string }).dmPolicy),
    groupAddMePolicy: normalizeSocialPolicy((user as { groupAddMePolicy?: string }).groupAddMePolicy),
    businessStatus: normalizeBusinessStatusValue((user as { businessStatus?: string | null }).businessStatus),
    businessContactPhone:
      normalizeBusinessStatusValue((user as { businessStatus?: string | null }).businessStatus) === "approved"
        ? ((user as { businessContactPhone?: string | null }).businessContactPhone ?? null)
        : null,
    businessAddress:
      normalizeBusinessStatusValue((user as { businessStatus?: string | null }).businessStatus) === "approved"
        ? ((user as { businessAddress?: string | null }).businessAddress ?? null)
        : null,
  };
}

/** Один закреплённый пост в шапке профиля (`users.pinned_post_id`). */
export async function updateMyPinnedPost(userId: string, body: Record<string, unknown>) {
  const b = body ?? {};
  if (!Object.prototype.hasOwnProperty.call(b, "postId")) {
    throw new UsersServiceError(400, "Укажите postId");
  }
  const raw = b.postId;
  const db = getDb();

  if (raw === null || raw === "") {
    await storage.updateUserProfile(userId, { pinnedPostId: null });
    const user = await storage.getUser(userId);
    return { pinnedPostId: (user as { pinnedPostId?: string | null }).pinnedPostId ?? null };
  }

  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) throw new UsersServiceError(400, "Пост не указан");

  const [p] = await db
    .select({
      id: posts.id,
      authorId: posts.authorId,
      isDraft: posts.isDraft,
      showOnAuthorWall: posts.showOnAuthorWall,
    })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!p) throw new UsersServiceError(404, "Пост не найден");
  if (p.authorId !== userId) throw new UsersServiceError(403, "Можно закрепить только свой пост");
  if (p.isDraft) throw new UsersServiceError(400, "Черновик нельзя закрепить");
  if (p.showOnAuthorWall === false) {
    throw new UsersServiceError(400, "Пост только для Push нельзя закрепить на профиле");
  }

  await storage.updateUserProfile(userId, { pinnedPostId: id });
  const user = await storage.getUser(userId);
  return { pinnedPostId: (user as { pinnedPostId?: string | null }).pinnedPostId ?? null };
}

export async function getProfilePage(viewerId: string, idParam: string, postsLimit: number) {
  const target = await resolveProfileTarget(idParam);
  if (target.deletedAt || target.isBlocked) {
    return { profile: buildUnavailableProfile(target), posts: [], stories: [] };
  }
  if (viewerId !== target.id) {
    const profileHidden = await storage.getBlockFlags(target.id, viewerId);
    if (profileHidden?.restrictProfile) {
      return { profile: buildUnavailableProfile(target), posts: [], stories: [] };
    }
  }
  const [profile, profilePosts, profileStories] = await Promise.all([
    buildProfileForViewer(viewerId, target),
    getAuthorWall(viewerId, target.id, postsLimit),
    getStoriesByAuthorId(target.id, viewerId),
  ]);
  if (viewerId !== target.id) {
    void recordProfilePageView(viewerId, target.id);
  }
  return { profile, posts: profilePosts, stories: profileStories };
}

export async function getProfileOnly(viewerId: string, idParam: string) {
  const target = await resolveProfileTarget(idParam);
  if (target.deletedAt || target.isBlocked) {
    return buildUnavailableProfile(target);
  }
  if (viewerId !== target.id) {
    const profileHidden = await storage.getBlockFlags(target.id, viewerId);
    if (profileHidden?.restrictProfile) {
      return buildUnavailableProfile(target);
    }
  }
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
  const followInserted = await storage.addFollow(viewerId, targetUserId);
  await storage.addContact(viewerId, targetUserId);
  notifyFollow(targetUserId, viewerId).catch((e) => console.error("[users] notify follow:", e));
  if (followInserted) {
    const { scheduleEdgeFollowReward } = await import("./edge-follow-hook");
    scheduleEdgeFollowReward(viewerId, targetUserId);
    const { scheduleSenderWelcomeDm } = await import("../sender/follow-hook");
    scheduleSenderWelcomeDm(targetUserId, viewerId);
  }
}

export async function unfollowUser(viewerId: string, targetUserId: string): Promise<void> {
  if (!targetUserId) throw new UsersServiceError(400, "userId не указан");
  await storage.removeFollow(viewerId, targetUserId);
}

/** Владелец профиля убирает пользователя из своих подписчиков (не блокирует). */
export async function removeMyFollower(ownerId: string, followerUserId: string): Promise<void> {
  if (!followerUserId || followerUserId === ownerId) {
    throw new UsersServiceError(400, "Некорректный пользователь");
  }
  const isFollower = await storage.isFollowing(followerUserId, ownerId);
  if (!isFollower) {
    throw new UsersServiceError(404, "Этот пользователь не подписан на вас");
  }
  await storage.removeFollow(followerUserId, ownerId);
}

async function ensureViewerCanAccessSocialGraph(viewerId: string, targetUserId: string): Promise<void> {
  if (viewerId === targetUserId) return;
  const [blockOfViewerByTarget, iFollowTarget] = await Promise.all([
    storage.getBlockFlags(targetUserId, viewerId),
    storage.isFollowing(viewerId, targetUserId),
  ]);
  if (blockOfViewerByTarget?.restrictProfile || blockOfViewerByTarget?.restrictSocial) {
    throw new UsersServiceError(403, "Список недоступен");
  }
  const target = await storage.getUser(targetUserId);
  const visibility = (target?.profileVisibility ?? "all").toLowerCase();
  if (visibility === "followers" && !iFollowTarget) {
    throw new UsersServiceError(403, "Список недоступен");
  }
}

export async function getFollowersList(viewerId: string, targetUserId: string, limit: number, offset: number) {
  await ensureViewerCanAccessSocialGraph(viewerId, targetUserId);
  return storage.getFollowersList(targetUserId, limit, offset);
}

export async function getFollowingList(viewerId: string, targetUserId: string, limit: number, offset: number) {
  await ensureViewerCanAccessSocialGraph(viewerId, targetUserId);
  return storage.getFollowingList(targetUserId, limit, offset);
}

export async function blockUser(
  blockerId: string,
  blockedId: string,
  flags?: Partial<{ restrictProfile: boolean; restrictChat: boolean; restrictSocial: boolean }>,
  note?: string | null,
): Promise<void> {
  if (!blockedId || blockedId === blockerId) {
    throw new UsersServiceError(400, "Нельзя заблокировать себя");
  }
  const target = await storage.getUser(blockedId);
  if (!target || target.deletedAt) {
    throw new UsersServiceError(404, "Пользователь не найден");
  }
  await storage.addBlock(blockerId, blockedId, flags, note);
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
    return Promise.all(
      contacts
        .filter((u): u is NonNullable<typeof u> => !!u && !u.deletedAt && !u.isBlocked)
        .map(async (u) => ({
          id: u.id,
          publicId: u.publicId,
          displayName: u.displayName ?? null,
          surname: u.surname ?? null,
          avatarUrl: await resolveMediaUrlForClient(u.avatarUrl ?? null),
        })),
    );
  }
  return ids;
}

const MAX_PHONES_IN_MATCH_REQUEST = 500;

export type ContactPhoneMatchRow = {
  id: string;
  publicId: number;
  displayName: string | null;
  surname: string | null;
  avatarUrl: string | null;
  isInMyContacts: boolean;
};

/** Сопоставление номеров из телефонной книги с аккаунтами Ping (только видимые в поиске, без взаимных блокировок). */
export async function matchContactsFromPhoneBook(
  viewerId: string,
  rawPhones: unknown
): Promise<{ matches: ContactPhoneMatchRow[] }> {
  if (!Array.isArray(rawPhones)) {
    throw new UsersServiceError(400, "Ожидается массив номеров в поле phones");
  }
  const normalized = new Set<string>();
  for (const item of rawPhones) {
    if (typeof item !== "string") continue;
    const n = normalizePhone(item);
    if (n) normalized.add(n);
    if (normalized.size >= MAX_PHONES_IN_MATCH_REQUEST) break;
  }
  const phones = [...normalized];
  if (phones.length === 0) {
    return { matches: [] };
  }
  const found = await storage.findUsersDiscoverableByPhones(phones, viewerId);
  const blocked = new Set(await storage.getBlockedRelationIds(viewerId));
  const contactIds = new Set(await storage.listContactUserIds(viewerId));

  function displaySortKey(u: { displayName: string | null; surname: string | null; publicId: number }) {
    const s = [u.displayName, u.surname].filter(Boolean).join(" ").trim();
    return s || String(u.publicId);
  }

  const unsorted = await Promise.all(
    found
      .filter((u) => !blocked.has(u.id))
      .map(async (u) => ({
        id: u.id,
        publicId: u.publicId,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        avatarUrl: await resolveMediaUrlForClient(u.avatarUrl ?? null),
        isInMyContacts: contactIds.has(u.id),
      })),
  );
  const matches = unsorted.sort((a, b) => displaySortKey(a).localeCompare(displaySortKey(b), "ru"));

  return { matches };
}
