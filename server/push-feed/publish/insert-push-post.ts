import type { PushTtlValue } from "@shared/schema";
import { insertPushPost as insertPushPostRow } from "../db/push-posts.queries";

export async function insertPushPost(params: {
  postId: string;
  authorId: string;
  ttl: PushTtlValue;
}): Promise<void> {
  await insertPushPostRow(params);
}
