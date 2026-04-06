import type { Express, Request, Response } from "express";
import type { User } from "@shared/schema";
import { avatarUploadMulter, persistAvatarUpload } from "../../upload/avatar";
import { coverUploadMulter, persistCoverUpload } from "../../upload/cover";
import { storage } from "../../storage";
import { writeAuditLog } from "../audit";
import { requireAdminOrSuper } from "../middleware";
import { loadStudioSyntheticUserDetail } from "./synthetic-user-detail";
import {
  createStudioSyntheticUser,
  createStudioSyntheticUserBodySchema,
  patchStudioSyntheticUser,
  patchStudioSyntheticUserBodySchema,
} from "./synthetic-user-service";
import { runMulterSingle } from "./multer-callback";
import { registerMediaStudioCampaignRoutes } from "./campaign-routes";

function adminUserJson(u: User) {
  const {
    password: _pw,
    phone: _ph,
    phoneCipher: _pc,
    phoneLookupHash: _lh,
    fcmToken: _fc,
    iosVoipToken: _voip,
    ...safe
  } = u as User & { password?: string };
  return safe;
}

function paramId(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? p[0] ?? "" : p ?? "";
}

async function getStudioSyntheticUserOr404(res: Response, userId: string): Promise<User | null> {
  const user = await storage.getUser(userId);
  if (!user || user.isStudioSynthetic !== true) {
    res.status(404).json({ message: "Studio user не найден" });
    return null;
  }
  return user;
}

export function registerAdminMediaStudioRoutes(app: Express): void {
  app.post("/api/admin/media-studio/synthetic-users", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const parsed = createStudioSyntheticUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Некорректные данные", issues: parsed.error.flatten() });
      return;
    }
    try {
      const user = await createStudioSyntheticUser(storage, { adminId: adminUserId, body: parsed.data });
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.synthetic_user.create",
        targetType: "user",
        targetId: user.id,
        details: { publicId: user.publicId, displayName: user.displayName },
        ip: req.ip,
      });
      res.status(201).json({ user: adminUserJson(user) });
    } catch (e) {
      console.error("media-studio synthetic create", e);
      res.status(500).json({ message: "Не удалось создать пользователя" });
    }
  });

  app.get("/api/admin/media-studio/synthetic-users", requireAdminOrSuper, async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    try {
      const result = await storage.listStudioSyntheticUsersForAdmin({ limit, offset });
      res.json({
        users: result.users.map(adminUserJson),
        total: result.total,
      });
    } catch (e) {
      console.error("media-studio synthetic list", e);
      res.status(500).json({ message: "Ошибка списка" });
    }
  });

  app.get("/api/admin/media-studio/synthetic-users/:id", requireAdminOrSuper, async (req: Request, res: Response) => {
    const id = paramId(req, "id");
    const user = await getStudioSyntheticUserOr404(res, id);
    if (!user) return;
    try {
      const detail = await loadStudioSyntheticUserDetail(user);
      res.json({
        user: adminUserJson(user),
        profileViewsTotal: detail.profileViewsTotal,
        profileViewsUniqueViewers: detail.profileViewsUniqueViewers,
        postsCount: detail.postsCount,
        recentPosts: detail.recentPosts.map((p) => ({
          id: p.id,
          text: p.text.length > 200 ? `${p.text.slice(0, 200)}…` : p.text,
          createdAt: p.createdAt.toISOString(),
          imageUrl: p.imageUrl,
        })),
      });
    } catch (e) {
      console.error("media-studio synthetic detail", e);
      res.status(500).json({ message: "Ошибка загрузки карточки" });
    }
  });

  app.patch("/api/admin/media-studio/synthetic-users/:id", requireAdminOrSuper, async (req: Request, res: Response) => {
    const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
    const id = paramId(req, "id");
    const existing = await getStudioSyntheticUserOr404(res, id);
    if (!existing) return;
    const parsed = patchStudioSyntheticUserBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Некорректные данные", issues: parsed.error.flatten() });
      return;
    }
    try {
      const updated = await patchStudioSyntheticUser(storage, { userId: id, body: parsed.data });
      if (!updated) {
        res.status(404).json({ message: "Пользователь не найден" });
        return;
      }
      await writeAuditLog({
        adminId: adminUserId,
        action: "media_studio.synthetic_user.update",
        targetType: "user",
        targetId: id,
        details: { keys: Object.keys(parsed.data) },
        ip: req.ip,
      });
      res.json({ user: adminUserJson(updated) });
    } catch (e) {
      console.error("media-studio synthetic patch", e);
      res.status(500).json({ message: "Не удалось сохранить профиль" });
    }
  });

  app.post(
    "/api/admin/media-studio/synthetic-users/:id/avatar",
    requireAdminOrSuper,
    runMulterSingle(avatarUploadMulter, "file", "Файл слишком большой (макс. 5 МБ)"),
    async (req: Request, res: Response) => {
      const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
      const id = paramId(req, "id");
      const existing = await getStudioSyntheticUserOr404(res, id);
      if (!existing) return;
      if (!req.file) {
        res.status(400).json({ message: "Файл не загружен (поле file)" });
        return;
      }
      try {
        const url = await persistAvatarUpload(req.file);
        const updated = await storage.updateUserProfile(id, { avatarUrl: url });
        if (!updated) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }
        await writeAuditLog({
          adminId: adminUserId,
          action: "media_studio.synthetic_user.avatar",
          targetType: "user",
          targetId: id,
          ip: req.ip,
        });
        res.status(201).json({ url, user: adminUserJson(updated) });
      } catch (e) {
        console.error("media-studio avatar", e);
        res.status(500).json({
          message: "Не удалось сохранить аватар. Для HEIC нужны sharp/libvips+HEIF или ffmpeg с libheif.",
        });
      }
    },
  );

  app.post(
    "/api/admin/media-studio/synthetic-users/:id/cover",
    requireAdminOrSuper,
    runMulterSingle(coverUploadMulter, "file", "Файл слишком большой (макс. 50 МБ)"),
    async (req: Request, res: Response) => {
      const adminUserId = (req as Request & { adminUserId: string }).adminUserId;
      const id = paramId(req, "id");
      const existing = await getStudioSyntheticUserOr404(res, id);
      if (!existing) return;
      if (!req.file) {
        res.status(400).json({ message: "Файл не загружен (поле file)" });
        return;
      }
      try {
        const url = await persistCoverUpload(req.file);
        const updated = await storage.updateUserProfile(id, { coverUrl: url, showCover: true });
        if (!updated) {
          res.status(404).json({ message: "Пользователь не найден" });
          return;
        }
        await writeAuditLog({
          adminId: adminUserId,
          action: "media_studio.synthetic_user.cover",
          targetType: "user",
          targetId: id,
          ip: req.ip,
        });
        res.status(201).json({ url, user: adminUserJson(updated) });
      } catch (e) {
        console.error("media-studio cover", e);
        res.status(500).json({ message: "Не удалось сохранить обложку" });
      }
    },
  );

  registerMediaStudioCampaignRoutes(app);
}
