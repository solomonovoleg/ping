import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import { normalizeProfileIdParam } from "../users/service";
import {
  ProfilePinsError,
  addPinItem,
  createPinFolder,
  deletePinFolder,
  deletePinItem,
  getPinFolderDetail,
  listPinFolders,
  updatePinFolder,
} from "./service";

function respondPinsError(res: Response, error: unknown): boolean {
  if (error instanceof ProfilePinsError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  return false;
}

export function registerProfilePinsRoutes(app: Express): void {
  app.get("/api/profile-pins/by-profile/:profileId", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const profileId = normalizeProfileIdParam(req.params.profileId);
    if (!profileId) {
      res.status(400).json({ message: "ID не указан" });
      return;
    }
    try {
      const data = await listPinFolders(viewerId, profileId);
      res.json(data);
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.get("/api/profile-pins/folders/:folderId", requireAuth, async (req: Request, res: Response) => {
    const viewerId = getUserId(req)!;
    const folderId = typeof req.params.folderId === "string" ? req.params.folderId : "";
    if (!folderId) {
      res.status(400).json({ message: "Папка не указана" });
      return;
    }
    try {
      const data = await getPinFolderDetail(viewerId, folderId);
      res.json(data);
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.post("/api/profile-pins/folders", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const row = await createPinFolder(userId, req.body ?? {});
      res.json(row);
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.patch("/api/profile-pins/folders/:folderId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = typeof req.params.folderId === "string" ? req.params.folderId : "";
    if (!folderId) {
      res.status(400).json({ message: "Папка не указана" });
      return;
    }
    try {
      const row = await updatePinFolder(userId, folderId, req.body ?? {});
      res.json(row);
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.delete("/api/profile-pins/folders/:folderId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = typeof req.params.folderId === "string" ? req.params.folderId : "";
    if (!folderId) {
      res.status(400).json({ message: "Папка не указана" });
      return;
    }
    try {
      await deletePinFolder(userId, folderId);
      res.json({ ok: true });
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.post("/api/profile-pins/folders/:folderId/items", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const folderId = typeof req.params.folderId === "string" ? req.params.folderId : "";
    if (!folderId) {
      res.status(400).json({ message: "Папка не указана" });
      return;
    }
    try {
      const row = await addPinItem(userId, folderId, req.body ?? {});
      res.json(row);
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });

  app.delete("/api/profile-pins/items/:itemId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const itemId = typeof req.params.itemId === "string" ? req.params.itemId : "";
    if (!itemId) {
      res.status(400).json({ message: "Элемент не указан" });
      return;
    }
    try {
      await deletePinItem(userId, itemId);
      res.json({ ok: true });
    } catch (e) {
      if (respondPinsError(res, e)) return;
      throw e;
    }
  });
}
