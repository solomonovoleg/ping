import type { Express, Request, Response } from "express";
import { requireAuth, getUserId } from "../auth/session";
import {
  createTrack,
  listTracks,
  getTrack,
  addMessageToTrack,
  removeTrackItem,
  setTrackItemDone,
  listTrackItems,
  updateTrack,
  deleteTrack,
  getTracksStats,
  TracksServiceError,
} from "./service";

function param(p: Record<string, string | string[] | undefined>, key: string): string {
  const v = p[key];
  return Array.isArray(v) ? v[0] ?? "" : (v ?? "");
}

export function registerTracksRoutes(app: Express): void {
  app.get("/api/tracks", requireAuth, async (_req: Request, res: Response) => {
    const userId = getUserId(_req)!;
    const list = await listTracks(userId);
    res.json(list);
  });

  app.get("/api/tracks/stats", requireAuth, async (_req: Request, res: Response) => {
    const userId = getUserId(_req)!;
    const stats = await getTracksStats(userId);
    res.json({
      ...stats,
      lastAddedAt: stats.lastAddedAt?.toISOString() ?? null,
    });
  });

  app.post("/api/tracks", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const { name } = req.body ?? {};
    const trackName = typeof name === "string" ? name.trim() || "Новый трек" : "Новый трек";
    const track = await createTrack(userId, trackName);
    res.status(201).json({ ...track, createdAt: track.createdAt.toISOString() });
  });

  app.get("/api/tracks/:trackId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    try {
      const track = await getTrack(userId, trackId);
      res.json(track);
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.post("/api/tracks/:trackId/items", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    const { messageId, chatId } = req.body ?? {};
    if (!messageId || typeof messageId !== "string" || !chatId || typeof chatId !== "string") {
      res.status(400).json({ message: "messageId и chatId обязательны" });
      return;
    }
    try {
      await addMessageToTrack(userId, trackId, messageId, chatId);
      res.status(201).json({ ok: true });
    } catch (error) {
      if (error instanceof TracksServiceError) {
        if (error.code === "FORBIDDEN") {
          res.status(403).json({ message: error.message });
          return;
        }
        if (error.code === "NOT_FOUND") {
          res.status(404).json({ message: error.message });
          return;
        }
      }
      throw error;
    }
  });

  app.patch("/api/tracks/:trackId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    const { name } = req.body ?? {};
    const trackName = typeof name === "string" ? name.trim() : "";
    if (!trackName) {
      res.status(400).json({ message: "name обязателен" });
      return;
    }
    try {
      await updateTrack(userId, trackId, { name: trackName });
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete("/api/tracks/:trackId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    try {
      await deleteTrack(userId, trackId);
      res.status(204).end();
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.delete("/api/tracks/:trackId/items/:itemId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    const itemId = param(req.params, "itemId");
    try {
      await removeTrackItem(userId, trackId, itemId);
      res.status(204).end();
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.patch("/api/tracks/:trackId/items/:itemId", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    const itemId = param(req.params, "itemId");
    const { done } = req.body ?? {};
    const isDone = done === true || done === "true";
    try {
      await setTrackItemDone(userId, trackId, itemId, isDone);
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });

  app.get("/api/tracks/:trackId/items", requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const trackId = param(req.params, "trackId");
    try {
      const items = await listTrackItems(userId, trackId);
      res.json(items);
    } catch (error) {
      if (error instanceof TracksServiceError && error.code === "NOT_FOUND") {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  });
}
