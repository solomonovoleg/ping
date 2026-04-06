import { storyViews } from "@shared/schema";
import { getDb } from "../../db";
import { loadAccessibleActiveStoryRow } from "../story-viewer-access/story-viewer-access";

export async function recordStoryView(storyId: string, viewerId: string): Promise<void> {
  const db = getDb();
  const story = await loadAccessibleActiveStoryRow(viewerId, storyId);
  if (story.authorId === viewerId) return;
  await db.insert(storyViews).values({ storyId, userId: viewerId }).onConflictDoNothing();
}
