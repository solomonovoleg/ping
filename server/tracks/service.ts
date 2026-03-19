import { storage } from "../storage";

export type TracksServiceErrorCode = "FORBIDDEN" | "NOT_FOUND";

export class TracksServiceError extends Error {
  code: TracksServiceErrorCode;
  constructor(code: TracksServiceErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export async function createTrack(userId: string, name: string) {
  return storage.createTrack(userId, name.trim() || "Новый трек");
}

export async function listTracks(userId: string) {
  const list = await storage.listTracks(userId);
  return list.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }));
}

export async function getTrack(userId: string, trackId: string) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  return { ...track, createdAt: track.createdAt.toISOString() };
}

export async function addMessageToTrack(userId: string, trackId: string, messageId: string, chatId: string) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  try {
    await storage.addMessageToTrack(userId, trackId, messageId, chatId);
  } catch (e) {
    if (e instanceof Error) {
      if (e.message.includes("доступ")) throw new TracksServiceError("FORBIDDEN", e.message);
      if (e.message.includes("найден")) throw new TracksServiceError("NOT_FOUND", e.message);
    }
    throw e;
  }
}

export async function removeTrackItem(userId: string, trackId: string, itemId: string) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  try {
    await storage.removeTrackItem(userId, trackId, itemId);
  } catch (e) {
    if (e instanceof Error && e.message.includes("найден")) {
      throw new TracksServiceError("NOT_FOUND", e.message);
    }
    throw e;
  }
}

export async function updateTrack(userId: string, trackId: string, data: { name: string }) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  await storage.updateTrack(userId, trackId, { name: data.name.trim() || track.name });
}

export async function deleteTrack(userId: string, trackId: string) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  await storage.deleteTrack(userId, trackId);
}

export async function getTracksStats(userId: string) {
  return storage.getTracksStats(userId);
}

export async function setTrackItemDone(userId: string, trackId: string, itemId: string, done: boolean) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  try {
    await storage.setTrackItemDone(userId, trackId, itemId, done);
  } catch (e) {
    if (e instanceof Error && e.message.includes("найден")) {
      throw new TracksServiceError("NOT_FOUND", e.message);
    }
    throw e;
  }
}

export async function listTrackItems(userId: string, trackId: string) {
  const track = await storage.getTrack(userId, trackId);
  if (!track) throw new TracksServiceError("NOT_FOUND", "Трек не найден");
  const items = await storage.listTrackItems(userId, trackId);
  return items.map((i) => ({
    ...i,
    messageCreatedAt: i.messageCreatedAt.toISOString(),
    addedAt: i.addedAt.toISOString(),
    doneAt: i.doneAt?.toISOString() ?? null,
  }));
}
