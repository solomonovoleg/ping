/** Сегмент `DbStorage`: треки и пункты. */
import type { DbStorageSegmentHost } from "./db-storage-segment-host";
import {
  dbStorageAddCallSegmentToTrack,
  dbStorageAddMessageToTrack,
  dbStorageCreateTrack,
  dbStorageDeleteTrack,
  dbStorageFindBestUserTrackByName,
  dbStorageGetTrack,
  dbStorageGetTracksStats,
  dbStorageListTrackItems,
  dbStorageListTracks,
  dbStorageRemoveTrackItem,
  dbStorageSetTrackItemDone,
  dbStorageUpdateTrack,
} from "./db-storage-facade-queries";

export const dbStorageSegmentTracks = {
  createTrack(host: DbStorageSegmentHost, userId: string, name: string): Promise<{ id: string; name: string; createdAt: Date }> {
    return dbStorageCreateTrack(host.db, userId, name);
  },

  listTracks(
    host: DbStorageSegmentHost,
    userId: string,
  ): Promise<
    { id: string; name: string; createdAt: Date; totalItems: number; activeItems: number; doneItems: number }[]
  > {
    return dbStorageListTracks(host.db, userId);
  },

  getTrack(
    host: DbStorageSegmentHost,
    userId: string,
    trackId: string,
  ): Promise<{ id: string; name: string; createdAt: Date } | undefined> {
    return dbStorageGetTrack(host.db, userId, trackId);
  },

  addMessageToTrack(
    host: DbStorageSegmentHost,
    userId: string,
    trackId: string,
    messageId: string,
    chatId: string,
  ): Promise<void> {
    return dbStorageAddMessageToTrack(host.db, userId, trackId, messageId, chatId);
  },

  addCallSegmentToTrack(
    host: DbStorageSegmentHost,
    userId: string,
    trackId: string,
    segmentId: string,
  ): Promise<void> {
    return dbStorageAddCallSegmentToTrack(host.db, userId, trackId, segmentId);
  },

  removeTrackItem(host: DbStorageSegmentHost, userId: string, trackId: string, itemId: string): Promise<void> {
    return dbStorageRemoveTrackItem(host.db, userId, trackId, itemId);
  },

  setTrackItemDone(
    host: DbStorageSegmentHost,
    userId: string,
    trackId: string,
    itemId: string,
    done: boolean,
  ): Promise<void> {
    return dbStorageSetTrackItemDone(host.db, userId, trackId, itemId, done);
  },

  updateTrack(host: DbStorageSegmentHost, userId: string, trackId: string, data: { name: string }): Promise<void> {
    return dbStorageUpdateTrack(host.db, userId, trackId, data);
  },

  deleteTrack(host: DbStorageSegmentHost, userId: string, trackId: string): Promise<void> {
    return dbStorageDeleteTrack(host.db, userId, trackId);
  },

  getTracksStats(
    host: DbStorageSegmentHost,
    userId: string,
  ): Promise<{ totalTracks: number; activeItemsCount: number; doneItemsCount: number; lastAddedAt: Date | null }> {
    return dbStorageGetTracksStats(host.db, userId);
  },

  listTrackItems(
    host: DbStorageSegmentHost,
    userId: string,
    trackId: string,
  ): Promise<
    {
      id: string;
      sourceType: "message" | "call_segment";
      messageId: string | null;
      chatId: string | null;
      callId: string | null;
      chatName: string;
      speakerDisplayName: string | null;
      content: string;
      type: string;
      messageCreatedAt: Date;
      addedAt: Date;
      doneAt: Date | null;
    }[]
  > {
    return dbStorageListTrackItems(host.db, userId, trackId, host.chatNameDeps());
  },

  findBestUserTrackByName(
    host: DbStorageSegmentHost,
    userId: string,
    nameQuery: string,
  ): Promise<{ id: string; name: string } | null> {
    return dbStorageFindBestUserTrackByName(host.db, userId, nameQuery);
  },
};
