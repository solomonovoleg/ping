import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { storage } from "../storage";
import { requireAuth, getUserId } from "../auth/session";
import { getDb } from "../db";
import { posts, postReactions, postComments, NAME_MAX_LENGTH } from "@shared/schema";
import { getAuthorWall } from "../posts/author-wall";
import { getStoriesByAuthorId } from "../stories/routes";
import { notifyFollow } from "../notifications/create";

export function registerUsersRoutes(app: Express): void {
  app.get("/api/users/search", requireAuth, async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json([]);
      return;
    }
    const userId = getUserId(req)!;
    const users = await storage.searchUsers(q, userId);
    res.json(
      users.map((u) => ({
        id: u.id,
        publicId: u.publicId,
        phone: u.phone,
        displayName: u.displayName ?? null,
        surname: u.surname ?? null,
        gender: u.gender ?? null,
        birthDate: u.birthDate ?? null,
        avatarUrl: u.avatarUrl ?? null,
      }))
    );
  });

  /** Сохранить FCM токен для пуш-уведомлений (Android) */
  app.post("/api/users/me/push-token", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : null;
    await storage.updateUserFcmToken(userId, token || null);
    res.json({ ok: true });
  });

  app.patch("/api/users/me", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const current = await storage.getUser(userId);
    if (!current) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    const { displayName, surname, gender, birthDate, avatarUrl, hideFromSearch, bio, coverUrl, profileLink, city, status, pinnedPostId, profileVisibility, showOnlineTo, pushEnabled } = req.body ?? {};
    let name = typeof displayName === "string" ? displayName.trim() : (current.displayName ?? "");
    let fam = typeof surname === "string" ? surname.trim() : (current.surname ?? "");
    name = name.slice(0, NAME_MAX_LENGTH);
    fam = fam.slice(0, NAME_MAX_LENGTH);
    if (!name || !fam) {
      res.status(400).json({ message: "Имя и фамилия обязательны" });
      return;
    }
    const genderVal = typeof gender === "string" && ["male", "female", "other"].includes(gender) ? gender : (current.gender ?? null);
    if (!current.gender && !genderVal) {
      res.status(400).json({ message: "Укажите пол (мужской, женский или другое)" });
      return;
    }
    const birthDateVal = birthDate !== undefined
      ? (typeof birthDate === "string" ? (birthDate.trim() || null) : null)
      : undefined;
    const user = await storage.updateUserProfile(userId, {
      displayName: name || null,
      surname: fam || null,
      gender: genderVal,
      ...(birthDateVal !== undefined && { birthDate: birthDateVal }),
      ...(typeof avatarUrl === "string" && { avatarUrl: avatarUrl.trim() || null }),
      ...(typeof hideFromSearch === "boolean" && { hideFromSearch }),
      ...(bio !== undefined && { bio: bio === null || bio === "" ? null : (typeof bio === "string" ? bio.trim() || null : null) }),
      ...(coverUrl !== undefined && { coverUrl: coverUrl === null || coverUrl === "" ? null : (typeof coverUrl === "string" ? coverUrl.trim() || null : null) }),
      ...(profileLink !== undefined && { profileLink: profileLink === null || profileLink === "" ? null : (typeof profileLink === "string" ? profileLink.trim() || null : null) }),
      ...(city !== undefined && { city: city === null || city === "" ? null : (typeof city === "string" ? city.trim() || null : null) }),
      ...(status !== undefined && { status: status === null || status === "" ? null : (typeof status === "string" ? status.trim() || null : null) }),
      ...(pinnedPostId !== undefined && { pinnedPostId: pinnedPostId === null || pinnedPostId === "" ? null : (typeof pinnedPostId === "string" ? pinnedPostId.trim() || null : null) }),
      ...(profileVisibility === "all" || profileVisibility === "followers" ? { profileVisibility } : {}),
      ...(showOnlineTo === "all" || showOnlineTo === "followers" ? { showOnlineTo } : {}),
      ...(typeof pushEnabled === "boolean" && { pushEnabled }),
    });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      publicId: user.publicId,
      phone: user.phone,
      displayName: user.displayName ?? null,
      surname: user.surname ?? null,
      gender: user.gender ?? null,
      birthDate: user.birthDate ?? null,
      avatarUrl: user.avatarUrl ?? null,
      hideFromSearch: user.hideFromSearch ?? false,
      bio: user.bio ?? null,
      coverUrl: user.coverUrl ?? null,
      profileLink: user.profileLink ?? null,
      city: (user as { city?: string | null }).city ?? null,
      status: (user as { status?: string | null }).status ?? null,
      pinnedPostId: (user as { pinnedPostId?: string | null }).pinnedPostId ?? null,
      profileVisibility: (user as { profileVisibility?: string }).profileVisibility ?? "all",
      showOnlineTo: (user as { showOnlineTo?: string }).showOnlineTo ?? "all",
      pushEnabled: (user as { pushEnabled?: boolean }).pushEnabled !== false,
    });
  });

  /** Страница профиля одним запросом: профиль + посты + сториз (цель загрузки ≤0.28 с). */
  app.get("/api/users/profile/:id/page", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!idParam) {
      res.status(400).json({ message: "ID не указан" });
      return;
    }
    let target = await storage.getUser(idParam);
    if (!target && /^\d+$/.test(String(idParam))) {
      target = await storage.getUserByPublicId(parseInt(String(idParam), 10));
    }
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    if (target.deletedAt || target.isBlocked) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
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
    const [followersCount, followingCount, profilePosts, profileStories] = await Promise.all([
      storage.getFollowersCount(target.id),
      storage.getFollowingCount(target.id),
      getAuthorWall(viewerId, target.id, Math.min(Number(req.query.postsLimit) || 50, 100)),
      getStoriesByAuthorId(target.id),
    ]);
    const db = getDb();
    const [postsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.authorId, target.id));
    const [reactionsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postReactions)
      .where(eq(postReactions.userId, target.id));
    const [commentsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postComments)
      .where(eq(postComments.userId, target.id));
    const profile = {
      id: target.id,
      publicId: target.publicId,
      displayName: target.displayName ?? null,
      surname: target.surname ?? null,
      gender: target.gender ?? null,
      avatarUrl: target.avatarUrl ?? null,
      coverUrl: target.coverUrl ?? null,
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
      postsCount: postsRow?.count ?? 0,
      reactionsCount: reactionsRow?.count ?? 0,
      commentsCount: commentsRow?.count ?? 0,
    };
    res.json({ profile, posts: profilePosts, stories: profileStories });
  });

  /** Публичный профиль по publicId или id; для текущего пользователя — canMessage всегда true */
  app.get("/api/users/profile/:id", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!idParam) {
      res.status(400).json({ message: "ID не указан" });
      return;
    }
    let target = await storage.getUser(idParam);
    if (!target && /^\d+$/.test(String(idParam))) {
      target = await storage.getUserByPublicId(parseInt(String(idParam), 10));
    }
    if (!target) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    if (target.deletedAt || target.isBlocked) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
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
    const [followersCount, followingCount] = await Promise.all([
      storage.getFollowersCount(target.id),
      storage.getFollowingCount(target.id),
    ]);
    const db = getDb();
    const [postsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(eq(posts.authorId, target.id));
    const [reactionsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postReactions)
      .where(eq(postReactions.userId, target.id));
    const [commentsRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postComments)
      .where(eq(postComments.userId, target.id));
    res.json({
      id: target.id,
      publicId: target.publicId,
      displayName: target.displayName ?? null,
      surname: target.surname ?? null,
      gender: target.gender ?? null,
      avatarUrl: target.avatarUrl ?? null,
      coverUrl: target.coverUrl ?? null,
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
      postsCount: postsRow?.count ?? 0,
      reactionsCount: reactionsRow?.count ?? 0,
      commentsCount: commentsRow?.count ?? 0,
    });
  });

  /** Подписаться на пользователя */
  app.post("/api/users/:userId/follow", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId || targetUserId === viewerId) {
      res.status(400).json({ message: "Нельзя подписаться на себя" });
      return;
    }
    const target = await storage.getUser(targetUserId);
    if (!target || target.deletedAt || target.isBlocked) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.addFollow(viewerId, targetUserId);
    await storage.addContact(viewerId, targetUserId);
    notifyFollow(targetUserId, viewerId).catch((e) => console.error("[users] notify follow:", e));
    res.json({ ok: true });
  });

  /** Отписаться */
  app.delete("/api/users/:userId/follow", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId) {
      res.status(400).json({ message: "userId не указан" });
      return;
    }
    await storage.removeFollow(viewerId, targetUserId);
    res.json({ ok: true });
  });

  /** Список подписчиков пользователя */
  app.get("/api/users/:userId/followers", requireAuth, async (req: Request, res: Response) => {
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId) {
      res.json([]);
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await storage.getFollowersList(targetUserId, limit, offset);
    res.json(list);
  });

  /** Список подписок пользователя */
  app.get("/api/users/:userId/following", requireAuth, async (req: Request, res: Response) => {
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId) {
      res.json([]);
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await storage.getFollowingList(targetUserId, limit, offset);
    res.json(list);
  });

  /** Заблокировать пользователя */
  app.post("/api/users/:userId/block", requireAuth, async (req: Request, res: Response) => {
    const blockerId = getUserId(req)!;
    const blockedId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!blockedId || blockedId === blockerId) {
      res.status(400).json({ message: "Нельзя заблокировать себя" });
      return;
    }
    const target = await storage.getUser(blockedId);
    if (!target || target.deletedAt) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.addBlock(blockerId, blockedId);
    res.json({ ok: true });
  });

  /** Разблокировать */
  app.delete("/api/users/:userId/block", requireAuth, async (req: Request, res: Response) => {
    const blockerId = getUserId(req)!;
    const blockedId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!blockedId) {
      res.status(400).json({ message: "userId не указан" });
      return;
    }
    await storage.removeBlock(blockerId, blockedId);
    res.json({ ok: true });
  });

  /** Добавить пользователя в контакты */
  app.post("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { contactUserId } = req.body ?? {};
    if (typeof contactUserId !== "string" || !contactUserId) {
      res.status(400).json({ message: "Укажите contactUserId" });
      return;
    }
    if (contactUserId === userId) {
      res.status(400).json({ message: "Нельзя добавить себя" });
      return;
    }
    const other = await storage.getUser(contactUserId);
    if (!other || other.deletedAt || other.isBlocked) {
      res.status(404).json({ message: "Пользователь не найден" });
      return;
    }
    await storage.addContact(userId, contactUserId);
    res.json({ ok: true });
  });

  /** Список контактов: массив id. ?list=1 — полные профили (id, publicId, displayName, surname, avatarUrl) для экрана контактов */
  app.get("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const ids = await storage.listContactUserIds(userId);
    if (req.query.list === "1" && ids.length > 0) {
      const contacts = await Promise.all(ids.map((id) => storage.getUser(id)));
      res.json(
        contacts
          .filter((u): u is NonNullable<typeof u> => !!u && !u.deletedAt && !u.isBlocked)
          .map((u) => ({
            id: u.id,
            publicId: u.publicId,
            displayName: u.displayName ?? null,
            surname: u.surname ?? null,
            avatarUrl: u.avatarUrl ?? null,
          }))
      );
      return;
    }
    res.json(ids);
  });
}
