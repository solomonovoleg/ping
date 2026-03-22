import type { Express, Request, Response } from "express";
import { contactsPhoneMatchLimiter, profilePatchLimiter } from "../auth/rate-limit";
import { requireAuth, getUserId } from "../auth/session";
import {
  addContact,
  blockUser,
  followUser,
  getFollowersList,
  getFollowingList,
  getProfileOnly,
  getProfilePage,
  listContacts,
  matchContactsFromPhoneBook,
  normalizeProfileIdParam,
  savePushToken,
  searchUsersForViewer,
  unfollowUser,
  unblockUser,
  updateMyProfile,
  UsersServiceError,
} from "./service";

function respondServiceError(res: Response, error: unknown): boolean {
  if (error instanceof UsersServiceError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}

export function registerUsersRoutes(app: Express): void {
  app.get("/api/users/search", requireAuth, async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!q) {
      res.json([]);
      return;
    }
    const userId = getUserId(req)!;
    const users = await searchUsersForViewer(userId, q);
    res.json(users);
  });

  app.post("/api/users/me/push-token", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const token = typeof req.body?.token === "string" ? req.body.token.trim() : null;
    await savePushToken(userId, token);
    res.json({ ok: true });
  });

  app.patch("/api/users/me", requireAuth, profilePatchLimiter, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const payload = await updateMyProfile(userId, (req.body ?? {}) as Record<string, unknown>);
      res.json(payload);
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/users/profile/:id/page", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const idParam = normalizeProfileIdParam(req.params.id);
    if (!idParam) {
      res.status(400).json({ message: "ID не указан" });
      return;
    }
    try {
      const payload = await getProfilePage(viewerId, idParam, Math.min(Number(req.query.postsLimit) || 50, 100));
      res.json(payload);
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/users/profile/:id", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const idParam = normalizeProfileIdParam(req.params.id);
    if (!idParam) {
      res.status(400).json({ message: "ID не указан" });
      return;
    }
    try {
      const payload = await getProfileOnly(viewerId, idParam);
      res.json(payload);
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/users/:userId/follow", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      await followUser(viewerId, targetUserId ?? "");
      res.json({ ok: true });
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/users/:userId/follow", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      await unfollowUser(viewerId, targetUserId ?? "");
      res.json({ ok: true });
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/users/:userId/followers", requireAuth, async (req: Request, res: Response) => {
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId) {
      res.json([]);
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await getFollowersList(targetUserId, limit, offset);
    res.json(list);
  });

  app.get("/api/users/:userId/following", requireAuth, async (req: Request, res: Response) => {
    const targetUserId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!targetUserId) {
      res.json([]);
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const list = await getFollowingList(targetUserId, limit, offset);
    res.json(list);
  });

  app.post("/api/users/:userId/block", requireAuth, async (req: Request, res: Response) => {
    const blockerId = getUserId(req)!;
    const blockedId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      const b = req.body;
      const flags =
        b && typeof b === "object"
          ? {
              restrictProfile: (b as { restrictProfile?: unknown }).restrictProfile !== false,
              restrictChat: (b as { restrictChat?: unknown }).restrictChat !== false,
              restrictSocial: (b as { restrictSocial?: unknown }).restrictSocial !== false,
            }
          : undefined;
      await blockUser(blockerId, blockedId ?? "", flags);
      res.json({ ok: true });
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.delete("/api/users/:userId/block", requireAuth, async (req: Request, res: Response) => {
    const blockerId = getUserId(req)!;
    const blockedId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    try {
      await unblockUser(blockerId, blockedId ?? "");
      res.json({ ok: true });
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { contactUserId } = req.body ?? {};
    try {
      await addContact(userId, typeof contactUserId === "string" ? contactUserId : "");
      res.json({ ok: true });
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.post("/api/contacts/match-phones", requireAuth, contactsPhoneMatchLimiter, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const payload = await matchContactsFromPhoneBook(userId, req.body?.phones);
      res.json(payload);
    } catch (error) {
      if (respondServiceError(res, error)) return;
      throw error;
    }
  });

  app.get("/api/contacts", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const payload = await listContacts(userId, req.query.list === "1");
    res.json(payload);
  });
}
