import { eq } from "drizzle-orm";
import { posts } from "@shared/schema";
import { getDb } from "../db";
import { callEdgeParticipantTask, type EdgePlatformTaskKey } from "../edge/call-participant-task";

const REF_MAX = 200;

/**
 * Асинхронно дергает EDGE, если у поста есть edge_id. Не блокирует основной ответ API.
 */
export function scheduleEdgeTaskAfterPostAction(
  userId: string,
  postId: string,
  taskKey: EdgePlatformTaskKey,
): void {
  void (async () => {
    try {
      const db = getDb();
      const [row] = await db.select({ edgeId: posts.edgeId }).from(posts).where(eq(posts.id, postId)).limit(1);
      const edgeId = row?.edgeId?.trim();
      if (!edgeId) return;
      const ref = postId.length > REF_MAX ? postId.slice(0, REF_MAX) : postId;
      await callEdgeParticipantTask({ platformUserId: userId, edgeId, taskKey, ref });
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[posts/edge-task-hook]", e);
      }
    }
  })();
}
